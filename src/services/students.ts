// students CRUD（Task 011）

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
  STUDENTS_COLLECTION,
  isValidStudentId,
  type NewStudentInput,
  type StudentDoc,
  type UpdateStudentInput,
} from '../types/student';

function studentRef(studentId: string) {
  return doc(db, STUDENTS_COLLECTION, studentId);
}

function snapshotToStudent(snap: { id: string; data: () => Record<string, unknown> }): StudentDoc {
  return { studentId: snap.id, ...(snap.data() as Omit<StudentDoc, 'studentId'>) };
}

export async function fetchStudent(studentId: string): Promise<StudentDoc | null> {
  const snap = await getDoc(studentRef(studentId));
  if (!snap.exists()) return null;
  return snapshotToStudent(snap);
}

interface SubscribeStudentsOptions {
  branchIds?: string[]; // undefined = 不做 server-side branch 過濾（HQ 用）
  activeOnly?: boolean;
}

export function subscribeStudents(
  options: SubscribeStudentsOptions,
  onChange: (students: StudentDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const constraints = [];
  if (options.branchIds && options.branchIds.length > 0) {
    // Firestore in 限制最多 30 個值；目前單一使用者所屬分校通常 ≤ 5。
    constraints.push(where('branchId', 'in', options.branchIds.slice(0, 30)));
  }
  if (options.activeOnly) {
    constraints.push(where('active', '==', true));
  }
  const q = query(collection(db, STUDENTS_COLLECTION), ...constraints, orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapshotToStudent)),
    (err) => onError?.(err),
  );
}

export async function createStudent(input: NewStudentInput): Promise<void> {
  const studentId = input.studentId.trim();
  if (!isValidStudentId(studentId)) {
    throw new Error('學號格式錯誤（僅限英數、_、- ，2-30 字元）');
  }
  if (!input.branchId.trim()) {
    throw new Error('請選擇分校');
  }
  if (!input.name.trim()) {
    throw new Error('請填寫學生姓名');
  }
  const existing = await getDoc(studentRef(studentId));
  if (existing.exists()) {
    throw new Error(`學號「${studentId}」已存在`);
  }
  await setDoc(studentRef(studentId), {
    branchId: input.branchId.trim(),
    name: input.name.trim(),
    gender: input.gender ?? 'other',
    birthday: input.birthday?.trim() ?? '',
    grade: input.grade?.trim() ?? '',
    parentName: input.parentName?.trim() ?? '',
    parentPhone: input.parentPhone?.trim() ?? '',
    mailingCity: input.mailingCity?.trim() ?? '',
    mailingDistrict: input.mailingDistrict?.trim() ?? '',
    mailingAddress: input.mailingAddress?.trim() ?? '',
    registeredAddressSameAsMailing: input.registeredAddressSameAsMailing ?? false,
    registeredCity: input.registeredCity?.trim() ?? '',
    registeredDistrict: input.registeredDistrict?.trim() ?? '',
    registeredAddress: input.registeredAddress?.trim() ?? '',
    emergencyContactName: input.emergencyContactName?.trim() ?? '',
    emergencyContactRelation: input.emergencyContactRelation?.trim() ?? '',
    notes: input.notes?.trim() ?? '',
    active: true,
    createdAt: serverTimestamp(),
  });
}

export async function updateStudent(studentId: string, patch: UpdateStudentInput): Promise<void> {
  const cleaned: Record<string, unknown> = {};
  if (patch.branchId !== undefined) cleaned.branchId = patch.branchId.trim();
  if (patch.name !== undefined) cleaned.name = patch.name.trim();
  if (patch.gender !== undefined) cleaned.gender = patch.gender;
  if (patch.birthday !== undefined) cleaned.birthday = patch.birthday.trim();
  if (patch.grade !== undefined) cleaned.grade = patch.grade.trim();
  if (patch.parentName !== undefined) cleaned.parentName = patch.parentName.trim();
  if (patch.parentPhone !== undefined) cleaned.parentPhone = patch.parentPhone.trim();
  if (patch.mailingCity !== undefined) cleaned.mailingCity = patch.mailingCity.trim();
  if (patch.mailingDistrict !== undefined) cleaned.mailingDistrict = patch.mailingDistrict.trim();
  if (patch.mailingAddress !== undefined) cleaned.mailingAddress = patch.mailingAddress.trim();
  if (patch.registeredAddressSameAsMailing !== undefined) cleaned.registeredAddressSameAsMailing = patch.registeredAddressSameAsMailing;
  if (patch.registeredCity !== undefined) cleaned.registeredCity = patch.registeredCity.trim();
  if (patch.registeredDistrict !== undefined) cleaned.registeredDistrict = patch.registeredDistrict.trim();
  if (patch.registeredAddress !== undefined) cleaned.registeredAddress = patch.registeredAddress.trim();
  if (patch.emergencyContactName !== undefined) cleaned.emergencyContactName = patch.emergencyContactName.trim();
  if (patch.emergencyContactRelation !== undefined) cleaned.emergencyContactRelation = patch.emergencyContactRelation.trim();
  if (patch.notes !== undefined) cleaned.notes = patch.notes.trim();
  if (patch.active !== undefined) cleaned.active = patch.active;
  if (Object.keys(cleaned).length === 0) return;
  await updateDoc(studentRef(studentId), cleaned);
}

export async function setStudentActive(studentId: string, active: boolean): Promise<void> {
  await updateDoc(studentRef(studentId), { active });
}

export async function deleteStudent(studentId: string): Promise<void> {
  await deleteDoc(studentRef(studentId));
}
