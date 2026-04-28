// instructors collection 型別定義（Task 046）

import type { Timestamp } from 'firebase/firestore';

export const INSTRUCTORS_COLLECTION = 'instructors';

export type SchoolStatus = 'graduated' | 'dropped' | 'enrolled';

export const SCHOOL_STATUS_LABELS: Record<SchoolStatus, string> = {
  graduated: '畢業',
  dropped: '肄業',
  enrolled: '就學中',
};

export interface InstructorDoc {
  instructorId: string;
  name: string;
  courses: string[];
  education: string;
  schoolStatus: SchoolStatus;
  schoolName: string;
  department: string;
  grade: string;
  phone1: string;
  phone2: string;
  mailingAddress: string;
  registeredAddressSameAsMailing: boolean;
  registeredAddress: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  active: boolean;
  createdAt?: Timestamp;
}

export type NewInstructorInput = Omit<InstructorDoc, 'createdAt'>;

export type UpdateInstructorInput = Partial<Omit<InstructorDoc, 'instructorId' | 'createdAt'>>;
