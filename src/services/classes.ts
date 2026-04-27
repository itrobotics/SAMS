// classes CRUD（Task 015）

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  CLASSES_COLLECTION,
  compareTime,
  isValidClassId,
  isValidTime,
  type ClassDoc,
  type NewClassInput,
  type UpdateClassInput,
} from '../types/class';

function classRef(classId: string) {
  return doc(db, CLASSES_COLLECTION, classId);
}

function snapshotToClass(snap: { id: string; data: () => Record<string, unknown> }): ClassDoc {
  return { classId: snap.id, ...(snap.data() as Omit<ClassDoc, 'classId'>) };
}

export async function fetchClass(classId: string): Promise<ClassDoc | null> {
  const snap = await getDoc(classRef(classId));
  if (!snap.exists()) return null;
  return snapshotToClass(snap);
}

interface SubscribeClassesOptions {
  branchIds?: string[]; // undefined = HQ 看全部
  weekday?: number;
  activeOnly?: boolean;
}

export function subscribeClasses(
  options: SubscribeClassesOptions,
  onChange: (classes: ClassDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const constraints = [];
  if (options.branchIds && options.branchIds.length > 0) {
    constraints.push(where('branchId', 'in', options.branchIds.slice(0, 30)));
  }
  if (options.weekday !== undefined) {
    constraints.push(where('weekday', '==', options.weekday));
  }
  if (options.activeOnly) {
    constraints.push(where('active', '==', true));
  }
  const q = query(collection(db, CLASSES_COLLECTION), ...constraints, orderBy('startTime', 'asc'));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapshotToClass)),
    (err) => onError?.(err),
  );
}

// 一次性查詢（給每日場次產生器用，不需要訂閱）
export async function listClassesForGeneration(weekday: number): Promise<ClassDoc[]> {
  const q = query(
    collection(db, CLASSES_COLLECTION),
    where('weekday', '==', weekday),
    where('active', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map(snapshotToClass);
}

function validateTimes(startTime: string, endTime: string): void {
  if (!isValidTime(startTime)) throw new Error('上課時間格式錯誤（需為 HH:mm）');
  if (!isValidTime(endTime)) throw new Error('下課時間格式錯誤（需為 HH:mm）');
  if (compareTime(startTime, endTime) >= 0) {
    throw new Error('下課時間必須晚於上課時間');
  }
}

export async function createClass(input: NewClassInput): Promise<void> {
  const classId = input.classId.trim();
  if (!isValidClassId(classId)) {
    throw new Error('班級代碼格式錯誤（僅限英數、_、-，2-30 字元）');
  }
  if (!input.branchId.trim()) throw new Error('請選擇分校');
  if (!input.name.trim()) throw new Error('請填寫班級名稱');
  if (input.weekday < 1 || input.weekday > 7) throw new Error('星期幾必須為 1-7');
  validateTimes(input.startTime, input.endTime);

  const existing = await getDoc(classRef(classId));
  if (existing.exists()) throw new Error(`班級代碼「${classId}」已存在`);

  await setDoc(classRef(classId), {
    branchId: input.branchId.trim(),
    name: input.name.trim(),
    teacherId: input.teacherId?.trim() ?? '',
    classroom: input.classroom?.trim() ?? '',
    weekday: input.weekday,
    startTime: input.startTime,
    endTime: input.endTime,
    active: true,
    createdAt: serverTimestamp(),
  });
}

export async function updateClass(classId: string, patch: UpdateClassInput): Promise<void> {
  const cleaned: Record<string, unknown> = {};
  if (patch.branchId !== undefined) cleaned.branchId = patch.branchId.trim();
  if (patch.name !== undefined) cleaned.name = patch.name.trim();
  if (patch.teacherId !== undefined) cleaned.teacherId = patch.teacherId.trim();
  if (patch.classroom !== undefined) cleaned.classroom = patch.classroom.trim();
  if (patch.weekday !== undefined) {
    if (patch.weekday < 1 || patch.weekday > 7) throw new Error('星期幾必須為 1-7');
    cleaned.weekday = patch.weekday;
  }
  if (patch.startTime !== undefined) cleaned.startTime = patch.startTime;
  if (patch.endTime !== undefined) cleaned.endTime = patch.endTime;
  if (patch.startTime !== undefined && patch.endTime !== undefined) {
    validateTimes(patch.startTime, patch.endTime);
  }
  if (patch.active !== undefined) cleaned.active = patch.active;
  if (Object.keys(cleaned).length === 0) return;
  await updateDoc(classRef(classId), cleaned);
}

export async function setClassActive(classId: string, active: boolean): Promise<void> {
  await updateDoc(classRef(classId), { active });
}
