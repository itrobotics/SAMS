// class_students CRUD（Task 016）
//
// 設計原則：
//   - 加入 = setDoc with merge → 重複加入安全（idempotent）
//   - 移除 = active=false（軟刪），方便日後查歷史關聯
//   - 完全刪除：deleteRoster() 給管理用，目前不在 UI 開放

import {
  collection,
  deleteDoc,
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
  CLASS_STUDENTS_COLLECTION,
  classStudentDocId,
  type ClassStudentDoc,
} from '../types/classStudent';

function csRef(classId: string, studentId: string) {
  return doc(db, CLASS_STUDENTS_COLLECTION, classStudentDocId(classId, studentId));
}

function snapshotToCS(snap: { id: string; data: () => Record<string, unknown> }): ClassStudentDoc {
  return { id: snap.id, ...(snap.data() as Omit<ClassStudentDoc, 'id'>) };
}

// 取得某班的學生關聯（給班級學生管理頁 Task 019 用）
export function subscribeClassRoster(
  classId: string,
  onChange: (rows: ClassStudentDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, CLASS_STUDENTS_COLLECTION),
    where('classId', '==', classId),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapshotToCS)),
    (err) => onError?.(err),
  );
}

// 取得某學生的班級關聯（給學生詳細頁 Task 014 後續顯示用）
export function subscribeStudentClasses(
  studentId: string,
  onChange: (rows: ClassStudentDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, CLASS_STUDENTS_COLLECTION),
    where('studentId', '==', studentId),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapshotToCS)),
    (err) => onError?.(err),
  );
}

// 一次性查詢：場次產生器需要拿某班的「啟用中」學生名單。
export async function listActiveStudentIdsForClass(classId: string): Promise<string[]> {
  const q = query(
    collection(db, CLASS_STUDENTS_COLLECTION),
    where('classId', '==', classId),
    where('active', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => (d.data() as ClassStudentDoc).studentId);
}

export async function addStudentToClass(input: {
  classId: string;
  studentId: string;
  branchId: string;
}): Promise<void> {
  await setDoc(
    csRef(input.classId, input.studentId),
    {
      classId: input.classId,
      studentId: input.studentId,
      branchId: input.branchId,
      active: true,
      joinedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function removeStudentFromClass(classId: string, studentId: string): Promise<void> {
  await updateDoc(csRef(classId, studentId), { active: false });
}

export async function reactivateStudentInClass(classId: string, studentId: string): Promise<void> {
  await updateDoc(csRef(classId, studentId), { active: true });
}

// 一次性查詢所有班級的啟用中學生人數（Task 048）
export async function fetchAllActiveClassStudentCounts(): Promise<Map<string, number>> {
  const q = query(
    collection(db, CLASS_STUDENTS_COLLECTION),
    where('active', '==', true),
  );
  const snap = await getDocs(q);
  const counts = new Map<string, number>();
  snap.docs.forEach((d) => {
    const classId = (d.data() as ClassStudentDoc).classId;
    counts.set(classId, (counts.get(classId) ?? 0) + 1);
  });
  return counts;
}

// 真正刪除（管理用）— 目前 UI 不開放
export async function deleteRoster(classId: string, studentId: string): Promise<void> {
  await deleteDoc(csRef(classId, studentId));
}
