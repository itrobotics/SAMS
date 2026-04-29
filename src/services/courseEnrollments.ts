// course_enrollments：add / remove / list by courseId

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  COURSE_ENROLLMENTS_COLLECTION,
  courseEnrollmentDocId,
  type CourseEnrollmentDoc,
  type CourseEnrollmentStatus,
} from '../types/courseEnrollment';

function enrollRef(courseId: string, studentId: string) {
  return doc(db, COURSE_ENROLLMENTS_COLLECTION, courseEnrollmentDocId(courseId, studentId));
}

function snapshotToEnroll(snap: { id: string; data: () => Record<string, unknown> }): CourseEnrollmentDoc {
  return { enrollmentId: snap.id, ...(snap.data() as Omit<CourseEnrollmentDoc, 'enrollmentId'>) };
}

export function subscribeCourseEnrollments(
  courseId: string,
  onChange: (list: CourseEnrollmentDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COURSE_ENROLLMENTS_COLLECTION),
    where('courseId', '==', courseId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(snapshotToEnroll);
      list.sort((a, b) => a.studentName.localeCompare(b.studentName));
      onChange(list);
    },
    (err) => onError?.(err),
  );
}

export async function listActiveEnrollments(courseId: string): Promise<CourseEnrollmentDoc[]> {
  const q = query(
    collection(db, COURSE_ENROLLMENTS_COLLECTION),
    where('courseId', '==', courseId),
    where('status', '==', 'active'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(snapshotToEnroll);
}

export async function addStudentToCourse(input: {
  courseId: string;
  branchId: string;
  studentId: string;
  studentName: string;
}): Promise<void> {
  await setDoc(
    enrollRef(input.courseId, input.studentId),
    {
      courseId: input.courseId,
      branchId: input.branchId,
      studentId: input.studentId,
      studentName: input.studentName,
      status: 'active' as CourseEnrollmentStatus,
      enrolledAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function setEnrollmentStatus(
  courseId: string,
  studentId: string,
  status: CourseEnrollmentStatus,
): Promise<void> {
  await updateDoc(enrollRef(courseId, studentId), { status });
}

export async function removeStudentFromCourse(courseId: string, studentId: string): Promise<void> {
  await updateDoc(enrollRef(courseId, studentId), { status: 'withdrawn' });
}
