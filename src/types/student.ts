// students collection 型別定義

import type { Timestamp } from 'firebase/firestore';

export type Gender = 'male' | 'female' | 'other';
export const GENDER_LABELS: Record<Gender, string> = { male: '男', female: '女', other: '其他' };

// 學員類型：小朋友 / 成人。共用出席、班級、課程方案，差異僅在基本資料欄位。
export type ProfileType = 'child' | 'adult';
export const PROFILE_TYPE_LABELS: Record<ProfileType, string> = { child: '小朋友', adult: '成人' };

// 兒童年級下拉選項
export const CHILD_GRADE_OPTIONS = [
  '小一', '小二', '小三', '小四', '小五', '小六',
  '國一', '國二', '國三',
  '高一', '高二', '高三',
];

// 成人最高學歷下拉選項
export const ADULT_EDUCATION_OPTIONS = ['高中/職', '專科', '大學', '碩士', '博士'];

// 小朋友 profile（profileType === 'child' 時存在）
export interface ChildProfile {
  grade: string;          // '小一'|'小二'|...|'小六'|'國一'|...|'高三'
  school: string;
  parent1Name: string;
  parent1Phone: string;
  parent1Email?: string;
  parent2Name?: string;
  parent2Phone?: string;
}

// 成人 profile（profileType === 'adult' 時存在）
export interface AdultProfile {
  birthDate?: string;     // YYYY-MM-DD
  education?: string;     // '高中/職'|'專科'|'大學'|'碩士'|'博士'
  graduateSchool?: string;
  major?: string;
  company?: string;
  jobTitle?: string;
  idNumber?: string;      // 身分證字號（職訓課程報名用）
  mobilePhone?: string;   // 手機
  homePhone?: string;     // 家裡電話
  email?: string;         // E-mail
}

export interface StudentDoc {
  studentId: string;
  branchId: string;
  name: string;
  gender: Gender;
  birthday: string;        // "YYYY-MM-DD" or ""
  // 學員類型，舊資料無此欄位時，讀取端應預設視為 'child'。
  profileType?: ProfileType;
  childProfile?: ChildProfile;
  adultProfile?: AdultProfile;
  // 舊欄位（向下相容）：建立後新流程改寫到 childProfile，舊資料仍保留並可被讀取
  grade: string;
  parentName: string;
  parentPhone: string;
  // 通訊地址
  mailingCity: string;
  mailingDistrict: string;
  mailingAddress: string;
  // 戶籍地址
  registeredAddressSameAsMailing: boolean;
  registeredCity: string;
  registeredDistrict: string;
  registeredAddress: string;
  // 緊急聯絡人
  emergencyContactName: string;
  emergencyContactRelation: string;
  notes: string;
  active: boolean;
  // F4 班級分析用（選填）
  educationLevel?: string; // 高中以下/高中/大學/碩士/博士/其他
  department?: string;     // 科系（自由文字）
  createdAt?: Timestamp;
}

export interface NewStudentInput {
  studentId: string;
  branchId: string;
  name: string;
  gender?: Gender;
  birthday?: string;
  profileType?: ProfileType;
  childProfile?: ChildProfile;
  adultProfile?: AdultProfile;
  grade?: string;
  parentName?: string;
  parentPhone?: string;
  mailingCity?: string;
  mailingDistrict?: string;
  mailingAddress?: string;
  registeredAddressSameAsMailing?: boolean;
  registeredCity?: string;
  registeredDistrict?: string;
  registeredAddress?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  notes?: string;
}

export interface UpdateStudentInput {
  branchId?: string;
  name?: string;
  gender?: Gender;
  birthday?: string;
  profileType?: ProfileType;
  // 設成 null 代表清空（切換類型時用）
  childProfile?: ChildProfile | null;
  adultProfile?: AdultProfile | null;
  grade?: string;
  parentName?: string;
  parentPhone?: string;
  mailingCity?: string;
  mailingDistrict?: string;
  mailingAddress?: string;
  registeredAddressSameAsMailing?: boolean;
  registeredCity?: string;
  registeredDistrict?: string;
  registeredAddress?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  notes?: string;
  active?: boolean;
}

export const STUDENTS_COLLECTION = 'students';

const STUDENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/;

export function isValidStudentId(id: string): boolean {
  return STUDENT_ID_PATTERN.test(id);
}

// 取得學員實際的 profileType。舊資料沒有此欄位 → 預設視為 'child'。
export function getProfileType(s: Pick<StudentDoc, 'profileType'>): ProfileType {
  return s.profileType ?? 'child';
}

// 從學員（含舊資料）取得 child profile 視圖。
// 若有 childProfile 直接回傳；否則用舊欄位 grade/parentName/parentPhone 組成。
export function getChildProfileView(
  s: Pick<StudentDoc, 'childProfile' | 'grade' | 'parentName' | 'parentPhone'>,
): ChildProfile {
  if (s.childProfile) return s.childProfile;
  return {
    grade: s.grade ?? '',
    school: '',
    parent1Name: s.parentName ?? '',
    parent1Phone: s.parentPhone ?? '',
  };
}
