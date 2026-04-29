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
  courseTypes: 'courseTypes',
  relationships: 'relationships',
} as const;

export type OptionKey = (typeof OPTION_KEYS)[keyof typeof OPTION_KEYS];

export const OPTION_LABELS: Record<OptionKey, string> = {
  courses: '可教授課程（講師）',
  courseTypes: '課程類型（班級）',
  relationships: '緊急聯絡人關係',
};

export const OPTION_DEFAULTS: Record<OptionKey, string[]> = {
  courses: ['scratch', 'micro:bit'],
  courseTypes: [
    'micro:bit',
    '科學實驗',
    'MPM',
    'ScratchJR',
    'Scratch',
    'Python 程式',
    'Minecraft',
    'C/C++程式',
    '數學',
    '社團',
    '其他',
    '安親',
    '3D列印',
    '機器人',
    '程式常態班',
    'Arcade',
    'Roblox',
    'AI',
    'Scratch/micro:bit',
  ],
  relationships: ['父', '母', '兄弟姐妹', '其他'],
};
