// course_sessions collection 型別定義
//
// 「學程場次」與「班級場次（sessions）」分離。班級的場次是依 weekday 自動產生，
// 學程的場次則由人工排：每場記錄日期、時間、實際時數、講師、教室。
//
// Firestore 路徑：`course_sessions/{courseSessionId}`，格式 `CS000001`。
// hours 由前端自動計算（endTime - startTime），亦可手動調整。

export const COURSE_SESSIONS_COLLECTION = 'course_sessions';

export type CourseSessionStatus = 'scheduled' | 'completed' | 'cancelled';

export const COURSE_SESSION_STATUS_LABELS: Record<CourseSessionStatus, string> = {
  scheduled: '待上課',
  completed: '已完成',
  cancelled: '已取消',
};

export interface CourseSessionDoc {
  courseSessionId: string;
  courseId: string;
  moduleId: string;
  branchId: string;
  date: string;         // YYYY-MM-DD
  startTime: string;    // HH:mm
  endTime: string;      // HH:mm
  hours: number;        // 本次實際時數
  instructorId: string;
  classroom: string;
  status: CourseSessionStatus;
  notes: string;
}

export interface NewCourseSessionInput {
  courseSessionId: string;
  courseId: string;
  moduleId: string;
  branchId: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  instructorId?: string;
  classroom?: string;
  status?: CourseSessionStatus;
  notes?: string;
}

export interface UpdateCourseSessionInput {
  moduleId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  hours?: number;
  instructorId?: string;
  classroom?: string;
  status?: CourseSessionStatus;
  notes?: string;
}

// "HH:mm" 起訖計算實際時數（小時，最多保留 2 位小數）。
export function computeHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map((s) => Number.parseInt(s, 10));
  const [eh, em] = endTime.split(':').map((s) => Number.parseInt(s, 10));
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return 0;
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return 0;
  return Math.round((diff / 60) * 100) / 100;
}
