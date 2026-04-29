// class_pricing collection 型別定義
//
// Firestore 路徑：`class_pricing/{pricingId}`，pricingId 為自動產生的 PRnnnnnn。
//
// 計費方式：
//   - per_class：每班次（整個班一筆）
//   - per_month：每人每月收 price 元
//   - per_session：每人每堂收 price 元
//   - batch：整批計費
//
// 預估營收 = price × 該班目前啟用中學生人數（client 端計算，不寫回 Firestore）。
// 註：per_class / batch 的營收計算等同於 price × 人數，與其他類型一致。

import type { Timestamp } from 'firebase/firestore';

export const CLASS_PRICING_COLLECTION = 'class_pricing';

export type PriceType = 'per_class' | 'per_month' | 'per_session' | 'batch';

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  per_class: '每班次',
  per_month: '每月',
  per_session: '每堂',
  batch: 'batch',
};

export const PRICE_TYPES: PriceType[] = ['per_class', 'per_month', 'per_session', 'batch'];

export function isValidPriceType(v: string): v is PriceType {
  return (PRICE_TYPES as string[]).includes(v);
}

export interface ClassPricingDoc {
  pricingId: string;
  classId: string;
  branchId: string;
  className: string;          // denormalized
  price: number;              // TWD，每人費用
  priceType: PriceType;
  notes: string;
  active: boolean;
  createdAt?: Timestamp;
  createdBy: string;
}

export interface NewClassPricingInput {
  classId: string;
  branchId: string;
  className: string;
  price: number;
  priceType: PriceType;
  notes?: string;
  active?: boolean;
  createdBy: string;
}

export interface UpdateClassPricingInput {
  classId?: string;
  branchId?: string;
  className?: string;
  price?: number;
  priceType?: PriceType;
  notes?: string;
  active?: boolean;
}
