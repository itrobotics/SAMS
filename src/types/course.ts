// courses collection 型別定義
//
// 「學程」與「班級（classes）」並列：班級是固定週期循環型（每週固定時段），
// 學程則是有總時數目標、固定一批學員、不一定固定週期的長期課程
// （例如 400 小時職訓課程）。
//
// Firestore 路徑：`courses/{courseId}`，courseId 格式 `CRS00001`（5 位數補零）。
// totalActualHours 由 course_sessions 的實際時數即時匯總（completed 場次累計）。

import type { Timestamp } from 'firebase/firestore';

export const COURSES_COLLECTION = 'courses';

export type CourseStatus = 'active' | 'completed' | 'cancelled';

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  active: '進行中',
  completed: '已完成',
  cancelled: '已取消',
};

export interface CourseDoc {
  courseId: string;
  branchId: string;
  name: string;
  description: string;
  totalPlannedHours: number;
  totalActualHours: number;
  defaultInstructorId: string;
  defaultClassroom: string;
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD
  status: CourseStatus;
  active: boolean;
  createdAt?: Timestamp;
}

export interface NewCourseInput {
  courseId: string;
  branchId: string;
  name: string;
  description?: string;
  totalPlannedHours: number;
  defaultInstructorId?: string;
  defaultClassroom?: string;
  startDate?: string;
  endDate?: string;
  status?: CourseStatus;
  active?: boolean;
}

export interface UpdateCourseInput {
  branchId?: string;
  name?: string;
  description?: string;
  totalPlannedHours?: number;
  totalActualHours?: number;
  defaultInstructorId?: string;
  defaultClassroom?: string;
  startDate?: string;
  endDate?: string;
  status?: CourseStatus;
  active?: boolean;
}
