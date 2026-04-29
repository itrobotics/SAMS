// course_attendance：checkin / updateStatus / list by courseSessionId

import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  COURSE_ATTENDANCE_COLLECTION,
  type CourseAttendanceDoc,
  type CourseAttendanceStatus,
} from '../types/courseAttendance';

function recRef(attendanceId: string) {
  return doc(db, COURSE_ATTENDANCE_COLLECTION, attendanceId);
}

function snapshotToRec(snap: { id: string; data: () => Record<string, unknown> }): CourseAttendanceDoc {
  return { attendanceId: snap.id, ...(snap.data() as Omit<CourseAttendanceDoc, 'attendanceId'>) };
}

export function subscribeCourseAttendance(
  courseSessionId: string,
  onChange: (list: CourseAttendanceDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COURSE_ATTENDANCE_COLLECTION),
    where('courseSessionId', '==', courseSessionId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(snapshotToRec);
      list.sort((a, b) => a.studentName.localeCompare(b.studentName));
      onChange(list);
    },
    (err) => onError?.(err),
  );
}

export function subscribeCourseAttendanceForCourse(
  courseId: string,
  onChange: (list: CourseAttendanceDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COURSE_ATTENDANCE_COLLECTION),
    where('courseId', '==', courseId),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapshotToRec)),
    (err) => onError?.(err),
  );
}

interface UpdateCourseAttendanceInput {
  status: CourseAttendanceStatus;
  operatorId?: string | null;
  setCheckinNow?: boolean;
  clearCheckin?: boolean;
}

export async function updateCourseAttendance(
  attendanceId: string,
  patch: UpdateCourseAttendanceInput,
): Promise<void> {
  const cleaned: Record<string, unknown> = { status: patch.status, method: 'MANUAL' };
  if (patch.operatorId !== undefined) cleaned.operatorId = patch.operatorId;
  if (patch.setCheckinNow) cleaned.checkinTime = serverTimestamp();
  if (patch.clearCheckin) cleaned.checkinTime = null;
  await updateDoc(recRef(attendanceId), cleaned);
}
