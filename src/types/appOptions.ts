// app_options collection 型別定義（Task 045）
// 每個 doc 代表一類下拉選項，key 為 doc ID（如 'courses', 'relationships'）

import type { Timestamp } from 'firebase/firestore';

export const APP_OPTIONS_COLLECTION = 'app_options';

export interface AppOptionsDoc {
  key: string;
  label: string;
  values: string[];
  updatedAt?: Timestamp;
}

export const OPTION_KEYS = {
  courses: 'courses',
  relationships: 'relationships',
} as const;

export type OptionKey = (typeof OPTION_KEYS)[keyof typeof OPTION_KEYS];

export const OPTION_LABELS: Record<OptionKey, string> = {
  courses: '可教授課程',
  relationships: '緊急聯絡人關係',
};

export const OPTION_DEFAULTS: Record<OptionKey, string[]> = {
  courses: ['scratch', 'micro:bit'],
  relationships: ['父', '母', '兄弟姐妹', '其他'],
};
