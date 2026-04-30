// course_sessions CRUD + subscribe
//
// 場次的兩種建立方式：
//   1) openCourseSessionFromSlot — 從某 module 的某 slot「開啟」一個場次（主要入口）
//      自動產生 courseSessionId（CS000001）、寫入 course_sessions + course_attendance
//      idempotent：同一 (courseId, moduleId, date, startTime) 已開啟過會直接拋錯
//   2) createCourseSession — 直接給定完整 input 的低階介面（保留給雜項場次或未來擴充）
//
// 任一種都會：
//   - 寫入 course_sessions 文件
//   - 為當下 active 學員批次建 course_attendance（status='SCHEDULED'）
// 刪除時連同 course_attendance 一起清除。

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
  type WriteBatch,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  COURSE_SESSIONS_COLLECTION,
  type CourseSessionDoc,
  type NewCourseSessionInput,
  type UpdateCourseSessionInput,
} from '../types/courseSession';
import {
  COURSE_ENROLLMENTS_COLLECTION,
  type CourseEnrollmentDoc,
} from '../types/courseEnrollment';
import {
  COURSE_ATTENDANCE_COLLECTION,
  courseAttendanceDocId,
  type CourseAttendanceDoc,
} from '../types/courseAttendance';
import type { CourseModuleDoc, CourseModuleSlot } from '../types/courseModule';
import { getNextId } from '../utils/autoId';

function csRef(courseSessionId: string) {
  return doc(db, COURSE_SESSIONS_COLLECTION, courseSessionId);
}

function snapshotToCS(snap: { id: string; data: () => Record<string, unknown> }): CourseSessionDoc {
  return { courseSessionId: snap.id, ...(snap.data() as Omit<CourseSessionDoc, 'courseSessionId'>) };
}

export async function fetchCourseSession(courseSessionId: string): Promise<CourseSessionDoc | null> {
  const snap = await getDoc(csRef(courseSessionId));
  if (!snap.exists()) return null;
  return snapshotToCS(snap);
}

export function subscribeCourseSessions(
  courseId: string,
  onChange: (list: CourseSessionDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COURSE_SESSIONS_COLLECTION),
    where('courseId', '==', courseId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(snapshotToCS);
      list.sort((a, b) => {
        const c = a.date.localeCompare(b.date);
        if (c !== 0) return c;
        return a.startTime.localeCompare(b.startTime);
      });
      onChange(list);
    },
    (err) => onError?.(err),
  );
}

// 分校 dashboard 用：某分校 + 某日的所有學程場次
interface SubscribeCourseSessionsForBranchDateOptions {
  branchId: string;
  date: string;
}
export function subscribeCourseSessionsForBranchDate(
  { branchId, date }: SubscribeCourseSessionsForBranchDateOptions,
  onChange: (list: CourseSessionDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COURSE_SESSIONS_COLLECTION),
    where('branchId', '==', branchId),
    where('date', '==', date),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(snapshotToCS);
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
      onChange(list);
    },
    (err) => onError?.(err),
  );
}

// HQ dashboard 用：某日跨分校的所有學程場次
export function subscribeAllCourseSessionsForDate(
  date: string,
  onChange: (list: CourseSessionDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COURSE_SESSIONS_COLLECTION),
    where('date', '==', date),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapshotToCS)),
    (err) => onError?.(err),
  );
}

// 從某 module 的某 slot 開啟場次（主要入口）
//   1) 找 module 上指定 slot（依 date + startTime 比對）
//   2) 檢查是否已開啟過（同 courseId + moduleId + date + startTime）
//   3) 產生 courseSessionId（CS000001）、寫場次 + 物化出席名單
export async function openCourseSessionFromSlot(
  module: CourseModuleDoc,
  slot: CourseModuleSlot,
): Promise<string> {
  if (!module.courseId) throw new Error('缺少課程代碼');
  if (!slot.date || !slot.startTime || !slot.endTime) throw new Error('時段資料不完整');

  // idempotent guard
  const existing = await findExistingSlotSession(module.courseId, module.moduleId, slot);
  if (existing) {
    throw new Error(`此時段已開啟（${existing.courseSessionId}）`);
  }

  const courseSessionId = await getNextId('CS', COURSE_SESSIONS_COLLECTION, 6);
  await setDoc(csRef(courseSessionId), {
    courseId: module.courseId,
    moduleId: module.moduleId,
    branchId: module.branchId,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    hours: Number(slot.hours) || 0,
    // 講師 / 教室從 module 帶過來（snapshot — 之後若 module 改動不會影響已開啟場次）
    instructorId: module.instructorId ?? '',
    classroom: module.classroom ?? '',
    status: 'scheduled',
    notes: '',
  });

  await materializeAttendance(courseSessionId, module.courseId, module.moduleId, module.branchId, slot.date);
  return courseSessionId;
}

// 找出某 (courseId, moduleId, date, startTime) 是否已有 session
export async function findExistingSlotSession(
  courseId: string,
  moduleId: string,
  slot: { date: string; startTime: string },
): Promise<CourseSessionDoc | null> {
  const q = query(
    collection(db, COURSE_SESSIONS_COLLECTION),
    where('courseId', '==', courseId),
    where('moduleId', '==', moduleId),
    where('date', '==', slot.date),
    where('startTime', '==', slot.startTime),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snapshotToCS(snap.docs[0]);
}

// 建立場次（直接給完整 input 的低階介面，保留給雜項場次）
export async function createCourseSession(input: NewCourseSessionInput): Promise<void> {
  if (!input.courseSessionId.trim()) throw new Error('場次代碼不可為空');
  if (!input.courseId.trim()) throw new Error('缺少課程代碼');
  if (!input.date) throw new Error('請填寫日期');
  if (!input.startTime || !input.endTime) throw new Error('請填寫起訖時間');
  if (input.startTime >= input.endTime) throw new Error('下課時間必須晚於上課時間');
  const hours = Number(input.hours);
  if (!Number.isFinite(hours) || hours < 0) throw new Error('時數必須為非負數');

  const existing = await getDoc(csRef(input.courseSessionId));
  if (existing.exists()) throw new Error(`場次代碼「${input.courseSessionId}」已存在`);

  await setDoc(csRef(input.courseSessionId), {
    courseId: input.courseId,
    moduleId: input.moduleId ?? '',
    branchId: input.branchId,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    hours,
    instructorId: input.instructorId?.trim() ?? '',
    classroom: input.classroom?.trim() ?? '',
    status: input.status ?? 'scheduled',
    notes: input.notes?.trim() ?? '',
  });

  await materializeAttendance(input.courseSessionId, input.courseId, input.moduleId ?? '', input.branchId, input.date);
}

// 內部共用：依 active enrollments 物化某場次的 course_attendance（status='SCHEDULED'）
// date 同時 denormalize 進 attendance 文件，dashboard 可用 branchId+date 一次撈
async function materializeAttendance(
  courseSessionId: string,
  courseId: string,
  moduleId: string,
  branchId: string,
  date: string,
): Promise<void> {
  const enrollSnap = await getDocs(
    query(
      collection(db, COURSE_ENROLLMENTS_COLLECTION),
      where('courseId', '==', courseId),
      where('status', '==', 'active'),
    ),
  );
  if (enrollSnap.empty) return;

  let batch: WriteBatch = writeBatch(db);
  let n = 0;
  for (const d of enrollSnap.docs) {
    const en = d.data() as CourseEnrollmentDoc;
    const recId = courseAttendanceDocId(courseSessionId, en.studentId);
    const ref = doc(db, COURSE_ATTENDANCE_COLLECTION, recId);
    batch.set(ref, {
      courseSessionId,
      courseId,
      moduleId,
      branchId,
      date,
      studentId: en.studentId,
      studentName: en.studentName,
      status: 'SCHEDULED',
      checkinTime: null,
      method: 'MANUAL',
      operatorId: null,
    } satisfies Omit<CourseAttendanceDoc, 'attendanceId'>);
    n += 1;
    if (n >= 450) { await batch.commit(); batch = writeBatch(db); n = 0; }
  }
  if (n > 0) await batch.commit();
}

export async function updateCourseSession(
  courseSessionId: string,
  patch: UpdateCourseSessionInput,
): Promise<void> {
  const cleaned: Record<string, unknown> = {};
  if (patch.moduleId !== undefined) cleaned.moduleId = patch.moduleId;
  if (patch.date !== undefined) cleaned.date = patch.date;
  if (patch.startTime !== undefined) cleaned.startTime = patch.startTime;
  if (patch.endTime !== undefined) cleaned.endTime = patch.endTime;
  if (patch.hours !== undefined) cleaned.hours = patch.hours;
  if (patch.instructorId !== undefined) cleaned.instructorId = patch.instructorId.trim();
  if (patch.classroom !== undefined) cleaned.classroom = patch.classroom.trim();
  if (patch.status !== undefined) cleaned.status = patch.status;
  if (patch.notes !== undefined) cleaned.notes = patch.notes.trim();
  if (Object.keys(cleaned).length === 0) return;
  await updateDoc(csRef(courseSessionId), cleaned);
}

export async function deleteCourseSession(courseSessionId: string): Promise<void> {
  // 連同 course_attendance 一起清
  const attSnap = await getDocs(
    query(
      collection(db, COURSE_ATTENDANCE_COLLECTION),
      where('courseSessionId', '==', courseSessionId),
    ),
  );
  let batch = writeBatch(db);
  let n = 0;
  for (const d of attSnap.docs) {
    batch.delete(d.ref);
    n += 1;
    if (n >= 450) { await batch.commit(); batch = writeBatch(db); n = 0; }
  }
  batch.delete(csRef(courseSessionId));
  await batch.commit();
}
