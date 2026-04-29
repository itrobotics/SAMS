// course_modules CRUD + subscribe
//
// 一個 course 對應多個 modules；以 courseId 為主要查詢條件。

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
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  COURSE_MODULES_COLLECTION,
  type CourseModuleDoc,
  type NewCourseModuleInput,
  type UpdateCourseModuleInput,
} from '../types/courseModule';
import {
  COURSE_SESSIONS_COLLECTION,
  type CourseSessionDoc,
} from '../types/courseSession';

function moduleRef(moduleId: string) {
  return doc(db, COURSE_MODULES_COLLECTION, moduleId);
}

function snapshotToModule(snap: { id: string; data: () => Record<string, unknown> }): CourseModuleDoc {
  return { moduleId: snap.id, ...(snap.data() as Omit<CourseModuleDoc, 'moduleId'>) };
}

export async function fetchCourseModule(moduleId: string): Promise<CourseModuleDoc | null> {
  const snap = await getDoc(moduleRef(moduleId));
  if (!snap.exists()) return null;
  return snapshotToModule(snap);
}

export function subscribeCourseModules(
  courseId: string,
  onChange: (list: CourseModuleDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COURSE_MODULES_COLLECTION),
    where('courseId', '==', courseId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(snapshotToModule);
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
      onChange(list);
    },
    (err) => onError?.(err),
  );
}

export async function createCourseModule(input: NewCourseModuleInput): Promise<void> {
  if (!input.moduleId.trim()) throw new Error('單元代碼不可為空');
  if (!input.courseId.trim()) throw new Error('缺少課程代碼');
  if (!input.name.trim()) throw new Error('請填寫單元名稱');
  const planned = Number(input.plannedHours);
  if (!Number.isFinite(planned) || planned < 0) {
    throw new Error('計畫時數必須為非負數');
  }
  const existing = await getDoc(moduleRef(input.moduleId));
  if (existing.exists()) throw new Error(`單元代碼「${input.moduleId}」已存在`);

  await setDoc(moduleRef(input.moduleId), {
    courseId: input.courseId,
    branchId: input.branchId,
    name: input.name.trim(),
    plannedHours: planned,
    actualHours: 0,
    order: input.order ?? 0,
    active: input.active ?? true,
  });
}

export async function updateCourseModule(moduleId: string, patch: UpdateCourseModuleInput): Promise<void> {
  const cleaned: Record<string, unknown> = {};
  if (patch.name !== undefined) cleaned.name = patch.name.trim();
  if (patch.plannedHours !== undefined) cleaned.plannedHours = patch.plannedHours;
  if (patch.actualHours !== undefined) cleaned.actualHours = patch.actualHours;
  if (patch.order !== undefined) cleaned.order = patch.order;
  if (patch.active !== undefined) cleaned.active = patch.active;
  if (Object.keys(cleaned).length === 0) return;
  await updateDoc(moduleRef(moduleId), cleaned);
}

export async function deleteCourseModule(moduleId: string): Promise<void> {
  await updateDoc(moduleRef(moduleId), { active: false });
}

// 撈某 course 所有 modules 的「已完成」實際時數 by moduleId
export async function fetchModuleActualHours(courseId: string): Promise<Map<string, number>> {
  const q = query(
    collection(db, COURSE_SESSIONS_COLLECTION),
    where('courseId', '==', courseId),
    where('status', '==', 'completed'),
  );
  const snap = await getDocs(q);
  const totals = new Map<string, number>();
  snap.docs.forEach((d) => {
    const data = d.data() as CourseSessionDoc;
    if (!data.moduleId) return;
    const cur = totals.get(data.moduleId) ?? 0;
    totals.set(data.moduleId, cur + (Number(data.hours) || 0));
  });
  return totals;
}
