// 每日場次產生器
//
// 行為：
//   1) 找出該日 weekday 的 active classes（可選 branchId 過濾）
//   2) 對每一班，找出該 weekday 對應的所有 meetings（可能多筆 — 同日多時段）
//   3) 對每個 meeting 建立 sessions/{sessionId}（merge 寫入 → idempotent）
//      sessionId 格式：${YYYYMMDD}_${classId}_${HHmm}
//   4) 撈該班 active 學生，批次建立 attendance_records/{recordId}
//      （merge 寫入 → 不會覆蓋已報到狀態，但會補上漏掉的學生）
//
// 為何 merge 而非 transaction：場次與紀錄通常一起產生，但只在「第一次建立」
// 該文件時才寫入完整欄位；後續若已存在但缺欄位，merge 會補齊 — 仍是冪等。
//
// 同日多 meeting 的處理：每個 meeting 都是獨立 session，學生跨 session 各自
// 維持自己的 attendance_records（同學生在週一 AM 與週一 PM 各有一筆紀錄）。

import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

import { db } from './firebase';
import { listClassesForGeneration } from './classes';
import { listActiveStudentIdsForClass } from './classStudents';
import { fetchStudent } from './students';
import {
  findMeetingsForDate,
  isoWeekday,
  type ClassDoc,
  type ClassMeeting,
} from '../types/class';
import { SESSIONS_COLLECTION, makeSessionId } from '../types/session';
import {
  ATTENDANCE_RECORDS_COLLECTION,
  makeRecordId,
} from '../types/attendance';
import { formatDateCompact, formatDateISO } from '../utils/date';

export interface GenerationSummary {
  date: string;            // YYYY-MM-DD
  weekday: number;         // ISO 1-7
  sessionsCreated: number; // 全新建立的 session 數
  sessionsExisting: number;// 已存在、本次只是 merge
  recordsCreated: number;  // 全新建立的 attendance_records 數
  recordsExisting: number; // 已存在、跳過
  classesProcessed: number;// 班級數（每班可能展開多個 sessions）
  errors: string[];
}

interface GenerateOptions {
  date?: Date;        // 預設 = 現在
  branchId?: string;  // 不指定 = 全部分校
}

export async function generateSessionsForDate(
  options: GenerateOptions = {},
): Promise<GenerationSummary> {
  const date = options.date ?? new Date();
  const weekday = isoWeekday(date);
  const dateISO = formatDateISO(date);
  const dateCompact = formatDateCompact(date);

  const summary: GenerationSummary = {
    date: dateISO,
    weekday,
    sessionsCreated: 0,
    sessionsExisting: 0,
    recordsCreated: 0,
    recordsExisting: 0,
    classesProcessed: 0,
    errors: [],
  };

  let classes: ClassDoc[] = [];
  try {
    classes = await listClassesForGeneration(weekday);
  } catch (e) {
    summary.errors.push(`載入班級失敗：${e instanceof Error ? e.message : String(e)}`);
    return summary;
  }

  if (options.branchId) {
    classes = classes.filter((c) => c.branchId === options.branchId);
  }
  summary.classesProcessed = classes.length;

  for (const klass of classes) {
    try {
      await processClass(klass, date, dateISO, dateCompact, summary);
    } catch (e) {
      summary.errors.push(
        `班級 ${klass.classId}：${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return summary;
}

async function processClass(
  klass: ClassDoc,
  date: Date,
  dateISO: string,
  dateCompact: string,
  summary: GenerationSummary,
): Promise<void> {
  const meetings = findMeetingsForDate(klass, date);
  if (meetings.length === 0) {
    // 理論不該發生（query 已過濾），紀錄就好
    summary.errors.push(`班級 ${klass.classId}：找不到對應 weekday 的 meeting`);
    return;
  }

  // 撈一次學生名單，給該班所有 sessions 共用
  const studentIds = await listActiveStudentIdsForClass(klass.classId);

  for (const meeting of meetings) {
    await processMeeting(klass, meeting, studentIds, dateISO, dateCompact, summary);
  }
}

async function processMeeting(
  klass: ClassDoc,
  meeting: ClassMeeting,
  studentIds: string[],
  dateISO: string,
  dateCompact: string,
  summary: GenerationSummary,
): Promise<void> {
  const sessionId = makeSessionId(dateCompact, klass.classId, meeting.startTime);
  const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
  const existingSession = await getDoc(sessionRef);

  // 解析「該 meeting 的有效教室 / 老師」— meeting 沒填就沿用 class 預設
  const effectiveClassroom = meeting.classroom?.trim() || klass.classroom || '';
  const effectiveTeacher = meeting.teacherId?.trim() || klass.teacherId || '';

  const batch = writeBatch(db);

  if (existingSession.exists()) {
    summary.sessionsExisting += 1;
    // 不覆蓋 status / createdAt；className / startTime / endTime / classroom / teacher
    // 如有變動則 merge 補上
    batch.set(
      sessionRef,
      {
        branchId: klass.branchId,
        classId: klass.classId,
        className: klass.name,
        date: dateISO,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        classroom: effectiveClassroom,
        teacherId: effectiveTeacher,
      },
      { merge: true },
    );
  } else {
    summary.sessionsCreated += 1;
    batch.set(sessionRef, {
      branchId: klass.branchId,
      classId: klass.classId,
      className: klass.name,
      date: dateISO,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      status: 'waiting',
      classroom: effectiveClassroom,
      teacherId: effectiveTeacher,
      createdAt: serverTimestamp(),
    });
  }

  // 為了「避免覆蓋已報到狀態」，逐筆檢查 attendance_records 是否存在
  for (const studentId of studentIds) {
    const recordId = makeRecordId(sessionId, studentId);
    const recRef = doc(db, ATTENDANCE_RECORDS_COLLECTION, recordId);
    const existing = await getDoc(recRef);
    if (existing.exists()) {
      summary.recordsExisting += 1;
      continue;
    }
    const student = await fetchStudent(studentId);
    batch.set(recRef, {
      sessionId,
      branchId: klass.branchId,
      classId: klass.classId,
      studentId,
      studentName: student?.name ?? studentId,
      status: 'SCHEDULED',
      method: null,
      confidence: null,
      checkinTime: null,
      operatorId: null,
    });
    summary.recordsCreated += 1;
  }

  await batch.commit();
}
