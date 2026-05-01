// survey_responses collection 型別定義（F3）
//
// 設計：問卷題目以常數硬編碼，不存 Firestore；
// survey_responses 儲存每位學員在某場次的填答結果。
// responseId 格式：`${sessionId}__${studentId}`（與 attendance_records 平行）。
//
// 填寫頁 /survey/:responseId 無需登入，responseId 本身作為「一次性 token」。

import type { Timestamp } from 'firebase/firestore';

export type SurveyQuestionType = 'scale5' | 'yesno';

export interface SurveyQuestion {
  id: number;
  text: string;
  type: SurveyQuestionType;
}

export interface SurveyResponseDoc {
  responseId: string;         // `${sessionId}__${studentId}`
  sessionId: string;
  classId: string;
  branchId: string;
  studentId: string;
  studentName: string;
  answers: Record<string, string>; // questionId.toString() → option value
  status: 'pending' | 'submitted';
  submittedAt: Timestamp | null;
  createdAt: Timestamp;
}

export const SURVEY_RESPONSES_COLLECTION = 'survey_responses';

export function makeSurveyResponseId(sessionId: string, studentId: string): string {
  return `${sessionId}__${studentId}`;
}

// 預設 10 題問卷（管理端與填寫端共用同一份常數）
export const DEFAULT_SURVEY_QUESTIONS: SurveyQuestion[] = [
  { id: 1, text: '整體課程滿意度', type: 'scale5' },
  { id: 2, text: '講師教學方式', type: 'scale5' },
  { id: 3, text: '課程內容難易度適中', type: 'scale5' },
  { id: 4, text: '課程節奏安排', type: 'scale5' },
  { id: 5, text: '教材與教具', type: 'scale5' },
  { id: 6, text: '上課環境與設備', type: 'scale5' },
  { id: 7, text: '課程對實務工作的幫助', type: 'scale5' },
  { id: 8, text: '與其他學員互動', type: 'scale5' },
  { id: 9, text: '是否願意推薦給朋友', type: 'yesno' },
  { id: 10, text: '整體學習收穫', type: 'scale5' },
];

export const SCALE5_OPTIONS = [
  { value: '1', label: '1 分' },
  { value: '2', label: '2 分' },
  { value: '3', label: '3 分' },
  { value: '4', label: '4 分' },
  { value: '5', label: '5 分' },
];

export const YESNO_OPTIONS = [
  { value: 'yes', label: '是' },
  { value: 'no', label: '否' },
  { value: 'partial', label: '部分' },
];
