// course_sessions CRUD + subscribe
//
// 場次由人工建立，建立時依 enrollments 同步寫入 course_attendance（status=ABSENT）。
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

// 建立場次：同時根據 active enrollments 建立 course_attendance（status=ABSENT）
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

  // 從 enrollments 撈 active 學員，逐筆建立 ABSENT 出席紀錄
  const enrollSnap = await getDocs(
    query(
      collection(db, COURSE_ENROLLMENTS_COLLECTION),
      where('courseId', '==', input.courseId),
      where('status', '==', 'active'),
    ),
  );
  if (enrollSnap.empty) return;

  let batch = writeBatch(db);
  let n = 0;
  for (const d of enrollSnap.docs) {
    const en = d.data() as CourseEnrollmentDoc;
    const recId = courseAttendanceDocId(input.courseSessionId, en.studentId);
    const ref = doc(db, COURSE_ATTENDANCE_COLLECTION, recId);
    batch.set(ref, {
      courseSessionId: input.courseSessionId,
      courseId: input.courseId,
      moduleId: input.moduleId ?? '',
      branchId: input.branchId,
      studentId: en.studentId,
      studentName: en.studentName,
      status: 'ABSENT',
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
