import type { Timestamp } from 'firebase/firestore';

export const CERTIFICATION_RECORDS_COLLECTION = 'certificationRecords';
export const EMPLOYMENT_STATUSES_COLLECTION = 'employmentStatuses';
export const COACHING_RECORDS_COLLECTION = 'coachingRecords';

export type EmploymentStatusType = 'employed' | 'unemployed' | 'self_employed' | 'studying' | 'other';
export type SalaryRange = 'under_30k' | '30k_40k' | '40k_50k' | 'over_50k';
export type RelatedToTraining = 'yes' | 'partial' | 'no';
export type ContactMethod = 'phone' | 'meeting' | 'email' | 'line';

export interface CertificationRecord {
  id: string;
  studentId: string;
  courseId: string;
  certName: string;
  examDate: string;
  passed: boolean;
  notes?: string;
  createdAt: Timestamp;
}

export interface EmploymentStatus {
  id: string;
  studentId: string;
  courseId: string;
  trackedAt: string;
  status: EmploymentStatusType;
  company?: string;
  jobTitle?: string;
  salaryRange?: SalaryRange;
  relatedToTraining?: RelatedToTraining;
  createdAt: Timestamp;
}

export interface CoachingRecord {
  id: string;
  studentId: string;
  courseId: string;
  contactAt: Timestamp;
  counselorName: string;
  contactMethod: ContactMethod;
  content: string;
  nextContactDate?: string;
  createdAt: Timestamp;
}

export interface EmploymentSummary {
  totalStudents: number;
  employedCount: number;
  employmentRate: number;
  salaryDistribution: Record<SalaryRange, number>;
  relatedToTrainingDistribution: Record<RelatedToTraining, number>;
  certPassCount: number;
  certTotalCount: number;
  certPassRate: number;
}

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatusType, string> = {
  employed: '已就業',
  unemployed: '未就業',
  self_employed: '自行創業',
  studying: '持續進修',
  other: '其他',
};

export const SALARY_RANGE_LABELS: Record<SalaryRange, string> = {
  under_30k: '30K 以下',
  '30k_40k': '30K–40K',
  '40k_50k': '40K–50K',
  over_50k: '50K 以上',
};

export const RELATED_TO_TRAINING_LABELS: Record<RelatedToTraining, string> = {
  yes: '相關',
  partial: '部分相關',
  no: '不相關',
};

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  phone: '電話',
  meeting: '面談',
  email: 'Email',
  line: 'LINE',
};
