// course_modules collection 型別定義
//
// 「課程單元」隸屬於某 course，例如「Python 基礎」、「Web 前端入門」等。
// 一個 course 可有多個 modules，每個 module 有自己的計畫時數與實際完成時數。
//
// Firestore 路徑：`course_modules/{moduleId}`，格式 `MOD00001`。

export const COURSE_MODULES_COLLECTION = 'course_modules';

export interface CourseModuleDoc {
  moduleId: string;
  courseId: string;
  branchId: string;
  name: string;
  plannedHours: number;
  actualHours: number;
  order: number;
  active: boolean;
}

export interface NewCourseModuleInput {
  moduleId: string;
  courseId: string;
  branchId: string;
  name: string;
  plannedHours: number;
  order?: number;
  active?: boolean;
}

export interface UpdateCourseModuleInput {
  name?: string;
  plannedHours?: number;
  actualHours?: number;
  order?: number;
  active?: boolean;
}
