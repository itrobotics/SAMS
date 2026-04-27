// 每日場次產生器（Task 022）
//
// 行為：
//   1) 找出該日 weekday 的 active classes（可選 branchId 過濾）
//   2) 對每一班建立 sessions/{sessionId}（merge 寫入 → idempotent）
//   3) 撈該班 active 學生，批次建立 attendance_records/{recordId}
//      （merge 寫入 → 不會覆蓋已報到狀態，但會補上漏掉的學生）
//
// 為何 merge 而非 transaction：場次與紀錄通常一起產生，但只在「第一次建立」
// 該文件時才寫入完整欄位；後續若已存在但缺欄位，merge 會補齊 — 仍是冪等。
//
// 未來可移到 Cloud Function 排程；目前由 Task 023 的手動按鈕觸發即可。

import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

import { db } from './firebase';
import { listClassesForGeneration } from './classes';
import { listActiveStudentIdsForClass } from './classStudents';
import { fetchStudent } from './students';
import { isoWeekday, type ClassDoc } from '../types/class';
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
  classesProcessed: number;
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
      await processClass(klass, dateISO, dateCompact, summary);
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
  dateISO: string,
  dateCompact: string,
  summary: GenerationSummary,
): Promise<void> {
  const sessionId = makeSessionId(dateCompact, klass.classId);
  const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
  const existingSession = await getDoc(sessionRef);

  // 撈學生
  const studentIds = await listActiveStudentIdsForClass(klass.classId);

  // 用 batch 一次寫入 session + 該班所有 attendance_records
  // Firestore batch 上限 500 ops；單班 ≤ 30 學生時遠遠不會碰到上限
  const batch = writeBatch(db);

  if (existingSession.exists()) {
    summary.sessionsExisting += 1;
    // 不覆蓋 status / createdAt；但 className / startTime 等如有變動，merge 補上
    batch.set(
      sessionRef,
      {
        branchId: klass.branchId,
        classId: klass.classId,
        className: klass.name,
        date: dateISO,
        startTime: klass.startTime,
        endTime: klass.endTime,
        classroom: klass.classroom ?? '',
        teacherId: klass.teacherId ?? '',
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
      startTime: klass.startTime,
      endTime: klass.endTime,
      status: 'waiting',
      classroom: klass.classroom ?? '',
      teacherId: klass.teacherId ?? '',
      createdAt: serverTimestamp(),
    });
  }

  // 為了「避免覆蓋已報到狀態」，逐筆檢查 attendance_records 是否存在
  // 通常單班 < 30 學生，序列化 getDoc 影響可接受
  for (const studentId of studentIds) {
    const recordId = makeRecordId(sessionId, studentId);
    const recRef = doc(db, ATTENDANCE_RECORDS_COLLECTION, recordId);
    const existing = await getDoc(recRef);
    if (existing.exists()) {
      summary.recordsExisting += 1;
      continue;
    }
    // 學生姓名快照：撈一次學生資料寫入紀錄
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
