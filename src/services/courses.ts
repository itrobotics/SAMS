// courses CRUD + subscribe

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  COURSES_COLLECTION,
  type CourseDoc,
  type NewCourseInput,
  type UpdateCourseInput,
} from '../types/course';
import {
  COURSE_MODULES_COLLECTION,
  type CourseModuleDoc,
} from '../types/courseModule';
import {
  COURSE_SESSIONS_COLLECTION,
  type CourseSessionDoc,
} from '../types/courseSession';
import {
  COURSE_ENROLLMENTS_COLLECTION,
  type CourseEnrollmentDoc,
} from '../types/courseEnrollment';
import {
  COURSE_ATTENDANCE_COLLECTION,
} from '../types/courseAttendance';

function courseRef(courseId: string) {
  return doc(db, COURSES_COLLECTION, courseId);
}

function snapshotToCourse(snap: { id: string; data: () => Record<string, unknown> }): CourseDoc {
  return { courseId: snap.id, ...(snap.data() as Omit<CourseDoc, 'courseId'>) };
}

export async function fetchCourse(courseId: string): Promise<CourseDoc | null> {
  const snap = await getDoc(courseRef(courseId));
  if (!snap.exists()) return null;
  return snapshotToCourse(snap);
}

interface SubscribeCoursesOptions {
  branchIds?: string[];
  activeOnly?: boolean;
  defaultInstructorId?: string; // teacher 視角
}

export function subscribeCourses(
  options: SubscribeCoursesOptions,
  onChange: (list: CourseDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const constraints = [];
  if (options.branchIds && options.branchIds.length > 0) {
    constraints.push(where('branchId', 'in', options.branchIds.slice(0, 30)));
  }
  if (options.activeOnly) {
    constraints.push(where('active', '==', true));
  }
  if (options.defaultInstructorId) {
    constraints.push(where('defaultInstructorId', '==', options.defaultInstructorId));
  }
  const q = query(collection(db, COURSES_COLLECTION), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(snapshotToCourse);
      list.sort((a, b) => a.name.localeCompare(b.name));
      onChange(list);
    },
    (err) => onError?.(err),
  );
}

export async function createCourse(input: NewCourseInput): Promise<void> {
  const courseId = input.courseId.trim();
  if (!courseId) throw new Error('課程代碼不可為空');
  if (!input.branchId.trim()) throw new Error('請選擇分校');
  if (!input.name.trim()) throw new Error('請填寫課程名稱');
  const planned = Number(input.totalPlannedHours);
  if (!Number.isFinite(planned) || planned < 0) {
    throw new Error('計畫總時數必須為非負數');
  }

  const existing = await getDoc(courseRef(courseId));
  if (existing.exists()) throw new Error(`課程代碼「${courseId}」已存在`);

  await setDoc(courseRef(courseId), {
    branchId: input.branchId.trim(),
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    totalPlannedHours: planned,
    totalActualHours: 0,
    defaultInstructorId: input.defaultInstructorId?.trim() ?? '',
    defaultClassroom: input.defaultClassroom?.trim() ?? '',
    startDate: input.startDate?.trim() ?? '',
    endDate: input.endDate?.trim() ?? '',
    status: input.status ?? 'active',
    active: input.active ?? true,
    createdAt: serverTimestamp(),
  });
}

export async function updateCourse(courseId: string, patch: UpdateCourseInput): Promise<void> {
  const cleaned: Record<string, unknown> = {};
  if (patch.branchId !== undefined) cleaned.branchId = patch.branchId.trim();
  if (patch.name !== undefined) cleaned.name = patch.name.trim();
  if (patch.description !== undefined) cleaned.description = patch.description.trim();
  if (patch.totalPlannedHours !== undefined) cleaned.totalPlannedHours = patch.totalPlannedHours;
  if (patch.totalActualHours !== undefined) cleaned.totalActualHours = patch.totalActualHours;
  if (patch.defaultInstructorId !== undefined) cleaned.defaultInstructorId = patch.defaultInstructorId.trim();
  if (patch.defaultClassroom !== undefined) cleaned.defaultClassroom = patch.defaultClassroom.trim();
  if (patch.startDate !== undefined) cleaned.startDate = patch.startDate.trim();
  if (patch.endDate !== undefined) cleaned.endDate = patch.endDate.trim();
  if (patch.status !== undefined) cleaned.status = patch.status;
  if (patch.active !== undefined) cleaned.active = patch.active;
  if (Object.keys(cleaned).length === 0) return;
  await updateDoc(courseRef(courseId), cleaned);
}

export async function setCourseActive(courseId: string, active: boolean): Promise<void> {
  await updateDoc(courseRef(courseId), { active });
}

// 完整刪除一個 course：連同 modules / sessions / enrollments / attendance 一起清掉。
// 用 batch 拆 500 筆一批以避開 Firestore batch 上限。
export async function deleteCourseDeep(courseId: string): Promise<void> {
  const collectionsToClean: Array<{ name: string; field: string }> = [
    { name: COURSE_MODULES_COLLECTION, field: 'courseId' },
    { name: COURSE_SESSIONS_COLLECTION, field: 'courseId' },
    { name: COURSE_ENROLLMENTS_COLLECTION, field: 'courseId' },
    { name: COURSE_ATTENDANCE_COLLECTION, field: 'courseId' },
  ];
  for (const c of collectionsToClean) {
    const snap = await getDocs(query(collection(db, c.name), where(c.field, '==', courseId)));
    let i = 0;
    let batch = writeBatch(db);
    for (const d of snap.docs) {
      batch.delete(d.ref);
      i += 1;
      if (i >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        i = 0;
      }
    }
    if (i > 0) await batch.commit();
  }
  // 最後刪 course 本體
  const tail = writeBatch(db);
  tail.delete(courseRef(courseId));
  await tail.commit();
}

// === enrollment / module 計數查詢（給列表頁顯示用） ===

// 一次撈出全部 active enrollments 計算每門 course 的學員數
export async function fetchAllActiveEnrollmentCounts(): Promise<Map<string, number>> {
  const q = query(
    collection(db, COURSE_ENROLLMENTS_COLLECTION),
    where('status', '==', 'active'),
  );
  const snap = await getDocs(q);
  const counts = new Map<string, number>();
  snap.docs.forEach((d) => {
    const data = d.data() as CourseEnrollmentDoc;
    counts.set(data.courseId, (counts.get(data.courseId) ?? 0) + 1);
  });
  return counts;
}

// 一次撈所有 modules 計算每門 course 的單元數
export async function fetchAllActiveModuleCounts(): Promise<Map<string, number>> {
  const q = query(collection(db, COURSE_MODULES_COLLECTION), where('active', '==', true));
  const snap = await getDocs(q);
  const counts = new Map<string, number>();
  snap.docs.forEach((d) => {
    const data = d.data() as CourseModuleDoc;
    counts.set(data.courseId, (counts.get(data.courseId) ?? 0) + 1);
  });
  return counts;
}

// 一次撈所有 sessions 計算每門 course 的「已完成」總時數（給列表頁進度條）
export async function fetchAllCourseActualHours(): Promise<Map<string, number>> {
  const q = query(
    collection(db, COURSE_SESSIONS_COLLECTION),
    where('status', '==', 'completed'),
  );
  const snap = await getDocs(q);
  const totals = new Map<string, number>();
  snap.docs.forEach((d) => {
    const data = d.data() as CourseSessionDoc;
    const cur = totals.get(data.courseId) ?? 0;
    totals.set(data.courseId, cur + (Number(data.hours) || 0));
  });
  return totals;
}
