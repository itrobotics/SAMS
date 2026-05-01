import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  CERTIFICATION_RECORDS_COLLECTION,
  COACHING_RECORDS_COLLECTION,
  EMPLOYMENT_STATUSES_COLLECTION,
  type CertificationRecord,
  type CoachingRecord,
  type EmploymentStatus,
  type EmploymentSummary,
  type RelatedToTraining,
  type SalaryRange,
} from '../types/employmentTracking';

// ─── CertificationRecord ──────────────────────────────────────────────────────

export function subscribeCertifications(
  studentId: string,
  onData: (data: CertificationRecord[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, CERTIFICATION_RECORDS_COLLECTION),
    where('studentId', '==', studentId),
    orderBy('examDate', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CertificationRecord, 'id'>) })));
  });
}

export function subscribeCertificationsByCourse(
  courseId: string,
  onData: (data: CertificationRecord[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, CERTIFICATION_RECORDS_COLLECTION),
    where('courseId', '==', courseId),
    orderBy('examDate', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CertificationRecord, 'id'>) })));
  });
}

export async function addCertification(
  data: Omit<CertificationRecord, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, CERTIFICATION_RECORDS_COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCertification(
  id: string,
  data: Partial<Omit<CertificationRecord, 'id' | 'createdAt' | 'studentId' | 'courseId'>>,
): Promise<void> {
  await updateDoc(doc(db, CERTIFICATION_RECORDS_COLLECTION, id), data as Record<string, unknown>);
}

export async function deleteCertification(id: string): Promise<void> {
  await deleteDoc(doc(db, CERTIFICATION_RECORDS_COLLECTION, id));
}

// ─── EmploymentStatus ─────────────────────────────────────────────────────────

export function subscribeEmploymentStatuses(
  studentId: string,
  onData: (data: EmploymentStatus[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, EMPLOYMENT_STATUSES_COLLECTION),
    where('studentId', '==', studentId),
    orderBy('trackedAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EmploymentStatus, 'id'>) })));
  });
}

export function subscribeEmploymentStatusesByCourse(
  courseId: string,
  onData: (data: EmploymentStatus[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, EMPLOYMENT_STATUSES_COLLECTION),
    where('courseId', '==', courseId),
    orderBy('trackedAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EmploymentStatus, 'id'>) })));
  });
}

export function subscribeAllEmploymentStatuses(
  onData: (data: EmploymentStatus[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, EMPLOYMENT_STATUSES_COLLECTION),
    orderBy('trackedAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EmploymentStatus, 'id'>) })));
  });
}

export async function addEmploymentStatus(
  data: Omit<EmploymentStatus, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, EMPLOYMENT_STATUSES_COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEmploymentStatus(
  id: string,
  data: Partial<Omit<EmploymentStatus, 'id' | 'createdAt' | 'studentId' | 'courseId'>>,
): Promise<void> {
  await updateDoc(doc(db, EMPLOYMENT_STATUSES_COLLECTION, id), data as Record<string, unknown>);
}

export async function deleteEmploymentStatus(id: string): Promise<void> {
  await deleteDoc(doc(db, EMPLOYMENT_STATUSES_COLLECTION, id));
}

// ─── CoachingRecord ───────────────────────────────────────────────────────────

export function subscribeCoachingRecords(
  studentId: string,
  onData: (data: CoachingRecord[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, COACHING_RECORDS_COLLECTION),
    where('studentId', '==', studentId),
    orderBy('contactAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CoachingRecord, 'id'>) })));
  });
}

export function subscribeCoachingRecordsByCourse(
  courseId: string,
  onData: (data: CoachingRecord[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, COACHING_RECORDS_COLLECTION),
    where('courseId', '==', courseId),
    orderBy('contactAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CoachingRecord, 'id'>) })));
  });
}

export async function addCoachingRecord(
  data: Omit<CoachingRecord, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, COACHING_RECORDS_COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCoachingRecord(
  id: string,
  data: Partial<Omit<CoachingRecord, 'id' | 'createdAt' | 'studentId' | 'courseId'>>,
): Promise<void> {
  await updateDoc(doc(db, COACHING_RECORDS_COLLECTION, id), data as Record<string, unknown>);
}

export async function deleteCoachingRecord(id: string): Promise<void> {
  await deleteDoc(doc(db, COACHING_RECORDS_COLLECTION, id));
}

// ─── Employment Summary ───────────────────────────────────────────────────────

export async function getEmploymentSummary(courseId: string): Promise<EmploymentSummary> {
  const [statusSnap, certSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, EMPLOYMENT_STATUSES_COLLECTION),
        where('courseId', '==', courseId),
        orderBy('trackedAt', 'desc'),
      ),
    ),
    getDocs(
      query(
        collection(db, CERTIFICATION_RECORDS_COLLECTION),
        where('courseId', '==', courseId),
      ),
    ),
  ]);

  const latestByStudent = new Map<string, EmploymentStatus>();
  for (const d of statusSnap.docs) {
    const status = { id: d.id, ...(d.data() as Omit<EmploymentStatus, 'id'>) };
    if (!latestByStudent.has(status.studentId)) {
      latestByStudent.set(status.studentId, status);
    }
  }

  const statuses = Array.from(latestByStudent.values());
  const totalStudents = statuses.length;
  const employedCount = statuses.filter(
    (s) => s.status === 'employed' || s.status === 'self_employed',
  ).length;

  const salaryDistribution: Record<SalaryRange, number> = {
    under_30k: 0,
    '30k_40k': 0,
    '40k_50k': 0,
    over_50k: 0,
  };
  const relatedToTrainingDistribution: Record<RelatedToTraining, number> = {
    yes: 0,
    partial: 0,
    no: 0,
  };

  for (const s of statuses) {
    if (s.salaryRange) salaryDistribution[s.salaryRange]++;
    if (s.relatedToTraining) relatedToTrainingDistribution[s.relatedToTraining]++;
  }

  const certifications = certSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<CertificationRecord, 'id'>),
  }));
  const certTotalCount = certifications.length;
  const certPassCount = certifications.filter((c) => c.passed).length;

  return {
    totalStudents,
    employedCount,
    employmentRate: totalStudents > 0 ? Math.round((employedCount / totalStudents) * 100) : 0,
    salaryDistribution,
    relatedToTrainingDistribution,
    certPassCount,
    certTotalCount,
    certPassRate: certTotalCount > 0 ? Math.round((certPassCount / certTotalCount) * 100) : 0,
  };
}
