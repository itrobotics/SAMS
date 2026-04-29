// classes CRUD
//
// 寫入：createClass / updateClass — 內部會自動 sortMeetings + deriveWeekdays，
// 不需 caller 提前處理。
//
// 查詢：
//   subscribeClasses({ branchIds, weekday?, activeOnly? })
//     - branchIds 仍走 server-side `where('branchId', 'in', ...)`（分校隔離邊界）
//     - weekday 過濾改 client-side（Firestore 不允許 in + array-contains 共存）
//     - 拿掉 orderBy('startTime')（ClassDoc 不再有單一 startTime）
//     - 排序由 client 端依 name 處理
//
//   listClassesForGeneration(weekday)
//     - 用 `where('weekdays', 'array-contains', weekday) + where('active', '==', true)`
//     - 需新 composite index（見 firestore.indexes.json）

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
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  CLASSES_COLLECTION,
  deriveWeekdays,
  isValidClassId,
  sortMeetings,
  validateMeetings,
  type ClassDoc,
  type ClassMeeting,
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
  weekday?: number;     // client-side 過濾，不參與 Firestore query
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
  if (options.activeOnly) {
    constraints.push(where('active', '==', true));
  }
  // 注意：不加 orderBy('startTime') 也不加 where('weekday', ...)。
  // weekday filter 在 client 端用 weekdays.includes() 處理。
  const q = query(collection(db, CLASSES_COLLECTION), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map(snapshotToClass);
      if (options.weekday !== undefined) {
        const wd = options.weekday;
        list = list.filter((c) => Array.isArray(c.weekdays) && c.weekdays.includes(wd));
      }
      // 客端統一按 name 排序，UI 穩定
      list.sort((a, b) => a.name.localeCompare(b.name));
      onChange(list);
    },
    (err) => onError?.(err),
  );
}

// 一次性查詢（給每日場次產生器用，不需要訂閱）。
// where('weekdays', 'array-contains', N) 需要 composite index 與 active。
export async function listClassesForGeneration(weekday: number): Promise<ClassDoc[]> {
  const q = query(
    collection(db, CLASSES_COLLECTION),
    where('weekdays', 'array-contains', weekday),
    where('active', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map(snapshotToClass);
}

export async function createClass(input: NewClassInput): Promise<void> {
  const classId = input.classId.trim();
  if (!isValidClassId(classId)) {
    throw new Error('班級代碼格式錯誤（僅限英數、_、-，2-30 字元）');
  }
  if (!input.branchId.trim()) throw new Error('請選擇分校');
  if (!input.name.trim()) throw new Error('請填寫班級名稱');

  // 驗證 + 正規化 meetings
  validateMeetings(input.meetings);
  const sorted = sortMeetings(input.meetings);
  const meetings = sorted.map(stripMeeting);
  const weekdays = deriveWeekdays(sorted);

  const existing = await getDoc(classRef(classId));
  if (existing.exists()) throw new Error(`班級代碼「${classId}」已存在`);

  await setDoc(classRef(classId), {
    branchId: input.branchId.trim(),
    name: input.name.trim(),
    teacherId: input.teacherId?.trim() ?? '',
    classroom: input.classroom?.trim() ?? '',
    courseType: input.courseType?.trim() ?? '',
    courseStartDate: input.courseStartDate?.trim() ?? '',
    courseEndDate: input.courseEndDate?.trim() ?? '',
    courseHours: input.courseHours ?? 0,
    meetings,
    weekdays,
    active: input.active ?? true,
    createdAt: serverTimestamp(),
  });
}

export async function updateClass(classId: string, patch: UpdateClassInput): Promise<void> {
  const cleaned: Record<string, unknown> = {};
  if (patch.branchId !== undefined) cleaned.branchId = patch.branchId.trim();
  if (patch.name !== undefined) cleaned.name = patch.name.trim();
  if (patch.teacherId !== undefined) cleaned.teacherId = patch.teacherId.trim();
  if (patch.classroom !== undefined) cleaned.classroom = patch.classroom.trim();
  if (patch.meetings !== undefined) {
    validateMeetings(patch.meetings);
    const sorted = sortMeetings(patch.meetings);
    cleaned.meetings = sorted.map(stripMeeting);
    cleaned.weekdays = deriveWeekdays(sorted);
  }
  if (patch.courseType !== undefined) cleaned.courseType = patch.courseType.trim();
  if (patch.courseStartDate !== undefined) cleaned.courseStartDate = patch.courseStartDate.trim();
  if (patch.courseEndDate !== undefined) cleaned.courseEndDate = patch.courseEndDate.trim();
  if (patch.courseHours !== undefined) cleaned.courseHours = patch.courseHours;
  if (patch.active !== undefined) cleaned.active = patch.active;
  if (Object.keys(cleaned).length === 0) return;
  await updateDoc(classRef(classId), cleaned);
}

export async function setClassActive(classId: string, active: boolean): Promise<void> {
  await updateDoc(classRef(classId), { active });
}

// Firestore 不允許 undefined 欄位，把選填的 override 欄位清除後再寫入。
function stripMeeting(m: ClassMeeting): Record<string, unknown> {
  const out: Record<string, unknown> = {
    weekday: m.weekday,
    startTime: m.startTime,
    endTime: m.endTime,
  };
  if (m.classroom !== undefined && m.classroom !== '') out.classroom = m.classroom;
  if (m.teacherId !== undefined && m.teacherId !== '') out.teacherId = m.teacherId;
  return out;
}
