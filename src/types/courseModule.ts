// course_modules collection 型別定義
//
// 「課程單元」隸屬於某 course，例如「Python 基礎」、「Web 前端入門」等。
// 一個 course 可有多個 modules；每個 module 有自己的講師、教室、與多筆「上課時段」。
//
// Firestore 路徑：`course_modules/{moduleId}`，格式 `MOD00001`。
//
// 設計：
//   - module 自帶單一 instructorId / classroom（不分「預設/覆蓋」）
//   - module 自帶 slots[]：每筆 = {date, startTime, endTime, hours}
//     hours 由前端自動算（endTime - startTime），可手動微調
//   - 「計畫時數」= slots.hours 加總（衍生，不另存）
//   - 「實際時數」= 該 module 下所有 status='completed' 的 course_sessions 加總
//
// 場次（course_sessions）的產生：
//   使用者按單元列裡某 slot 的「開啟」按鈕 → 才把該 slot 物化為 course_sessions 文件
//   並批次寫入該課程當下 active 學員的 course_attendance（status='SCHEDULED'）
//   slot ↔ session 的識別：(courseId, moduleId, date, startTime) 唯一

import { computeHours } from './courseSession';

export const COURSE_MODULES_COLLECTION = 'course_modules';

export interface CourseModuleSlot {
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  hours: number;      // 預設由 startTime/endTime 自動算；可手動覆寫
}

export interface CourseModuleDoc {
  moduleId: string;
  courseId: string;
  branchId: string;
  name: string;
  instructorId: string;       // 單一講師（不分「預設/覆蓋」）
  classroom: string;          // 單一教室
  slots: CourseModuleSlot[];  // 上課時段陣列；可空（規劃中）
  actualHours: number;        // 由場次完成時數彙總
  order: number;
  active: boolean;
}

export interface NewCourseModuleInput {
  moduleId: string;
  courseId: string;
  branchId: string;
  name: string;
  instructorId?: string;
  classroom?: string;
  slots?: CourseModuleSlot[];
  order?: number;
  active?: boolean;
}

export interface UpdateCourseModuleInput {
  name?: string;
  instructorId?: string;
  classroom?: string;
  slots?: CourseModuleSlot[];
  actualHours?: number;
  order?: number;
  active?: boolean;
}

// 加總一組 slots 的 hours（顯示「計畫時數」用）
export function sumSlotHours(slots: CourseModuleSlot[] | undefined): number {
  if (!slots || slots.length === 0) return 0;
  const total = slots.reduce((sum, s) => sum + (Number(s.hours) || 0), 0);
  // 浮點誤差修正到 2 位小數
  return Math.round(total * 100) / 100;
}

// 排序 slots：date asc, 同 date 再 startTime asc
export function sortSlots(slots: CourseModuleSlot[]): CourseModuleSlot[] {
  return [...slots].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });
}

// 驗證一組 slots；通過則 return，違規則 throw 中文訊息
export function validateSlots(slots: CourseModuleSlot[]): void {
  if (!Array.isArray(slots)) return;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s.date) throw new Error(`第 ${i + 1} 筆時段缺日期`);
    if (!s.startTime) throw new Error(`第 ${i + 1} 筆時段缺開始時間`);
    if (!s.endTime) throw new Error(`第 ${i + 1} 筆時段缺結束時間`);
    if (s.startTime >= s.endTime) {
      throw new Error(`第 ${i + 1} 筆時段：結束時間必須晚於開始時間`);
    }
    if (!Number.isFinite(s.hours) || s.hours < 0) {
      throw new Error(`第 ${i + 1} 筆時段：時數必須為非負數`);
    }
  }
  // 同 date 內時段重疊檢查
  const byDate = new Map<string, CourseModuleSlot[]>();
  for (const s of slots) {
    const arr = byDate.get(s.date) ?? [];
    arr.push(s);
    byDate.set(s.date, arr);
  }
  for (const [date, ds] of byDate) {
    if (ds.length < 2) continue;
    const sorted = [...ds].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.startTime === curr.startTime && prev.endTime === curr.endTime) {
        throw new Error(`${date} ${curr.startTime}–${curr.endTime}：與另一筆完全相同`);
      }
      if (prev.endTime > curr.startTime) {
        throw new Error(
          `${date}：時段重疊（${prev.startTime}–${prev.endTime} 與 ${curr.startTime}–${curr.endTime}）`,
        );
      }
    }
  }
}

// 產生「MOD00001-1」這種顯示用標籤（依 sortSlots 後 index）
export function slotLabel(moduleId: string, indexAfterSort: number): string {
  return `${moduleId}-${indexAfterSort + 1}`;
}

// 對 slot 自動算 hours（給表單初次帶值用）
export function slotWithAutoHours(s: CourseModuleSlot): CourseModuleSlot {
  return { ...s, hours: computeHours(s.startTime, s.endTime) };
}
