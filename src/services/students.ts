// students CRUD（Task 011）

import {
  collection,
  deleteDoc,
  deleteField,
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
  type AdultProfile,
  type ChildProfile,
  type NewStudentInput,
  type ProfileType,
  type StudentDoc,
  type UpdateStudentInput,
} from '../types/student';

function studentRef(studentId: string) {
  return doc(db, STUDENTS_COLLECTION, studentId);
}

function snapshotToStudent(snap: { id: string; data: () => Record<string, unknown> }): StudentDoc {
  return { studentId: snap.id, ...(snap.data() as Omit<StudentDoc, 'studentId'>) };
}

// 將 ChildProfile 清理成 Firestore 友善（移除 undefined / 空字串保留）
function cleanChildProfile(p: ChildProfile): Record<string, unknown> {
  const out: Record<string, unknown> = {
    grade: p.grade?.trim() ?? '',
    school: p.school?.trim() ?? '',
    parent1Name: p.parent1Name?.trim() ?? '',
    parent1Phone: p.parent1Phone?.trim() ?? '',
  };
  if (p.parent1Email !== undefined) out.parent1Email = p.parent1Email.trim();
  if (p.parent2Name !== undefined) out.parent2Name = p.parent2Name.trim();
  if (p.parent2Phone !== undefined) out.parent2Phone = p.parent2Phone.trim();
  return out;
}

function cleanAdultProfile(p: AdultProfile): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.birthDate !== undefined) out.birthDate = p.birthDate.trim();
  if (p.education !== undefined) out.education = p.education.trim();
  if (p.graduateSchool !== undefined) out.graduateSchool = p.graduateSchool.trim();
  if (p.major !== undefined) out.major = p.major.trim();
  if (p.company !== undefined) out.company = p.company.trim();
  if (p.jobTitle !== undefined) out.jobTitle = p.jobTitle.trim();
  if (p.idNumber !== undefined) out.idNumber = p.idNumber.trim();
  return out;
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
  const profileType: ProfileType = input.profileType ?? 'child';

  // 為了兼容舊頁面（StudentsPage 列表會直接讀 grade / parentName / parentPhone），
  // 兒童類型同時把資料映射回頂層舊欄位；成人則填空字串。
  const legacyGrade = profileType === 'child'
    ? (input.childProfile?.grade ?? input.grade ?? '').trim()
    : '';
  const legacyParentName = profileType === 'child'
    ? (input.childProfile?.parent1Name ?? input.parentName ?? '').trim()
    : '';
  const legacyParentPhone = profileType === 'child'
    ? (input.childProfile?.parent1Phone ?? input.parentPhone ?? '').trim()
    : '';

  const existing = await getDoc(studentRef(studentId));
  if (existing.exists()) {
    throw new Error(`學號「${studentId}」已存在`);
  }

  const data: Record<string, unknown> = {
    branchId: input.branchId.trim(),
    name: input.name.trim(),
    gender: input.gender ?? 'other',
    birthday: input.birthday?.trim() ?? '',
    profileType,
    grade: legacyGrade,
    parentName: legacyParentName,
    parentPhone: legacyParentPhone,
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
  };
  if (profileType === 'child' && input.childProfile) {
    data.childProfile = cleanChildProfile(input.childProfile);
  }
  if (profileType === 'adult' && input.adultProfile) {
    data.adultProfile = cleanAdultProfile(input.adultProfile);
  }
  await setDoc(studentRef(studentId), data);
}

export async function updateStudent(studentId: string, patch: UpdateStudentInput): Promise<void> {
  const cleaned: Record<string, unknown> = {};
  if (patch.branchId !== undefined) cleaned.branchId = patch.branchId.trim();
  if (patch.name !== undefined) cleaned.name = patch.name.trim();
  if (patch.gender !== undefined) cleaned.gender = patch.gender;
  if (patch.birthday !== undefined) cleaned.birthday = patch.birthday.trim();
  if (patch.profileType !== undefined) cleaned.profileType = patch.profileType;
  if (patch.childProfile === null) cleaned.childProfile = deleteField();
  else if (patch.childProfile !== undefined) cleaned.childProfile = cleanChildProfile(patch.childProfile);
  if (patch.adultProfile === null) cleaned.adultProfile = deleteField();
  else if (patch.adultProfile !== undefined) cleaned.adultProfile = cleanAdultProfile(patch.adultProfile);
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
