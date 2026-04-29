// classes collection 型別定義
//
// Firestore 路徑：`classes/{classId}`，classId 為使用者指定的英數短代碼
// （如 "C001"）。
//
// 一個班級可有多組「上課時段」（meetings）；每組指定 weekday + startTime +
// endTime，可選擇性 override 教室 / 老師。**同一 weekday 可以有多筆**
// （例如週一上午一位老師、週一下午另一位老師）— 這跟 sessionId 加帶 HHmm
// 後綴的設計一起運作，避免同日多場彼此覆蓋。
//
// 下游 SessionDoc 在場次產生時把對應 meeting 的 startTime / endTime /
// classroom / teacherId 固化進去，因此 dashboard / kiosk / session page
// 完全不需要讀 ClassDoc。
//
// 範例：
//   C001 = Scratch 全期班（預設教室 301、預設老師 T001）
//     meetings:
//       { weekday: 1, startTime: '09:00', endTime: '12:00',
//         classroom: '301', teacherId: 'T002' }
//       { weekday: 1, startTime: '13:30', endTime: '16:30',
//         classroom: '302', teacherId: 'T001' }
//       { weekday: 3, startTime: '13:30', endTime: '16:30' }   // 沿用預設
//     weekdays: [1, 3]   ← 衍生欄位，給 Firestore array-contains 查詢用

import type { Timestamp } from 'firebase/firestore';

// 一組上課時段
export interface ClassMeeting {
  weekday: number;       // 1-7（ISO；1=Mon）
  startTime: string;     // "HH:mm"
  endTime: string;       // "HH:mm"
  classroom?: string;    // 選填；未填則沿用 ClassDoc.classroom
  teacherId?: string;    // 選填；未填則沿用 ClassDoc.teacherId
}

export interface ClassDoc {
  classId: string;
  branchId: string;
  name: string;
  teacherId: string;          // 預設講師
  classroom: string;          // 預設教室
  courseType: string;         // 課程類型
  courseStartDate: string;    // "YYYY-MM-DD" or ""
  courseEndDate: string;      // "YYYY-MM-DD" or ""
  courseHours: number;        // 總上課時數
  meetings: ClassMeeting[];   // 至少一筆；同 weekday 可有多筆但不可重疊
  weekdays: number[];         // 衍生：去重排序，給 array-contains 用
  active: boolean;
  createdAt?: Timestamp;
}

export interface NewClassInput {
  classId: string;
  branchId: string;
  name: string;
  teacherId?: string;
  classroom?: string;
  courseType?: string;
  courseStartDate?: string;
  courseEndDate?: string;
  courseHours?: number;
  meetings: ClassMeeting[];
  active?: boolean;
}

export interface UpdateClassInput {
  branchId?: string;
  name?: string;
  teacherId?: string;
  classroom?: string;
  courseType?: string;
  courseStartDate?: string;
  courseEndDate?: string;
  courseHours?: number;
  meetings?: ClassMeeting[];
  active?: boolean;
}

export const CLASSES_COLLECTION = 'classes';

const CLASS_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidClassId(id: string): boolean {
  return CLASS_ID_PATTERN.test(id);
}

export function isValidTime(t: string): boolean {
  return TIME_PATTERN.test(t);
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六', 7: '週日',
};

// 把 JS Date.getDay()（0=Sun..6=Sat）轉為 ISO weekday（1=Mon..7=Sun）。
export function isoWeekday(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

// 比較兩個 "HH:mm" 字串：a < b ⇒ 負值
export function compareTime(a: string, b: string): number {
  return a.localeCompare(b);
}

// "HH:mm" → 從 0 時起算的分鐘數，方便做區間比較
export function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(':').map((s) => Number.parseInt(s, 10));
  return h * 60 + m;
}

// === ClassMeeting 工具函式 ===

// 衍生 weekdays 欄位：去重 + 排序。寫入 Firestore 前一律走過。
export function deriveWeekdays(meetings: ClassMeeting[]): number[] {
  return Array.from(new Set(meetings.map((m) => m.weekday))).sort((a, b) => a - b);
}

// 排序 meetings：先 weekday，同 weekday 再 startTime。寫入 Firestore 前一律走過。
export function sortMeetings(meetings: ClassMeeting[]): ClassMeeting[] {
  return [...meetings].sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return compareTime(a.startTime, b.startTime);
  });
}

// 驗證一組 meetings；通過則 return，違規則 throw 含中文訊息。
// 規則：
//   1) 至少一筆
//   2) weekday 1-7
//   3) startTime / endTime 為 "HH:mm" 且 startTime < endTime
//   4) 同一 weekday 可有多筆，但時段不可重疊（端點相等視為合法 — 連堂）
//   5) 完全相同的時段（同 weekday + 同 start + 同 end）視為重複
export function validateMeetings(meetings: ClassMeeting[]): void {
  if (!Array.isArray(meetings) || meetings.length === 0) {
    throw new Error('請至少設定一組上課時段');
  }

  // 個別欄位檢查
  for (const m of meetings) {
    if (!Number.isInteger(m.weekday) || m.weekday < 1 || m.weekday > 7) {
      throw new Error(`星期幾必須為 1-7（收到 ${m.weekday}）`);
    }
    if (!isValidTime(m.startTime)) {
      throw new Error(`上課時間格式錯誤（需為 HH:mm，收到「${m.startTime}」）`);
    }
    if (!isValidTime(m.endTime)) {
      throw new Error(`下課時間格式錯誤（需為 HH:mm，收到「${m.endTime}」）`);
    }
    if (compareTime(m.startTime, m.endTime) >= 0) {
      const label = WEEKDAY_LABELS[m.weekday] ?? `週${m.weekday}`;
      throw new Error(`${label} ${m.startTime}–${m.endTime}：下課時間必須晚於上課時間`);
    }
  }

  // 同 weekday 內時段重疊檢查：把每天的 meetings 按 startTime 排序後逐對比較
  const byWeekday = new Map<number, ClassMeeting[]>();
  for (const m of meetings) {
    const arr = byWeekday.get(m.weekday) ?? [];
    arr.push(m);
    byWeekday.set(m.weekday, arr);
  }
  for (const [weekday, dayMeetings] of byWeekday) {
    if (dayMeetings.length < 2) continue;
    const sorted = [...dayMeetings].sort((a, b) => compareTime(a.startTime, b.startTime));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.startTime === curr.startTime && prev.endTime === curr.endTime) {
        const label = WEEKDAY_LABELS[weekday] ?? `週${weekday}`;
        throw new Error(`${label} ${curr.startTime}–${curr.endTime}：與另一筆完全相同，不可重複`);
      }
      // 端點相等（prev.endTime === curr.startTime）視為連堂，合法
      if (compareTime(prev.endTime, curr.startTime) > 0) {
        const label = WEEKDAY_LABELS[weekday] ?? `週${weekday}`;
        throw new Error(
          `${label}：時段重疊（${prev.startTime}–${prev.endTime} 與 ${curr.startTime}–${curr.endTime}）`,
        );
      }
    }
  }
}

// 給某個日期，回傳該班該日所有對應的 meetings（依 startTime 排序）。
// 用於場次產生器：對每個命中的 meeting 各自寫一筆 SessionDoc。
export function findMeetingsForDate(klass: ClassDoc, date: Date): ClassMeeting[] {
  const wd = isoWeekday(date);
  return klass.meetings
    .filter((m) => m.weekday === wd)
    .sort((a, b) => compareTime(a.startTime, b.startTime));
}

// 顯示用：把多組 meeting 拼成一行人類可讀字串。
//   「週一 09:00–12:00、週一 13:30–16:30、週三 13:30–16:30」
// 同 weekday 的多筆會各自列出（不嘗試合併），讓使用者一眼看清每段時間。
export function formatMeetingsLabel(meetings: ClassMeeting[]): string {
  if (meetings.length === 0) return '—';
  return sortMeetings(meetings)
    .map((m) => `${WEEKDAY_LABELS[m.weekday] ?? `週${m.weekday}`} ${m.startTime}–${m.endTime}`)
    .join('、');
}
