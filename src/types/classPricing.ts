// class_pricing collection 型別定義
//
// Firestore 路徑：`class_pricing/{pricingId}`，pricingId 為自動產生的 PRnnnnnn。
//
// 同一個 classId 可有多筆，以 effectiveFrom / effectiveTo（YYYY-MM）區分時期。
// effectiveTo === null 代表「目前仍有效，無結束月份」。
//
// 計費方式：
//   - per_month：每人每月收 price 元
//   - per_session：每人每堂收 price 元
//
// 預估營收 = price × 該班目前啟用中學生人數（client 端計算，不寫回 Firestore）。

import type { Timestamp } from 'firebase/firestore';

export const CLASS_PRICING_COLLECTION = 'class_pricing';

export type PriceType = 'per_month' | 'per_session';

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  per_month: '每月',
  per_session: '每堂',
};

export interface ClassPricingDoc {
  pricingId: string;
  classId: string;
  branchId: string;
  className: string;          // denormalized
  price: number;              // TWD，每人費用
  priceType: PriceType;
  effectiveFrom: string;      // "YYYY-MM"
  effectiveTo: string | null; // "YYYY-MM"，null = 目前有效
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
  effectiveFrom: string;
  effectiveTo?: string | null;
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
  effectiveFrom?: string;
  effectiveTo?: string | null;
  notes?: string;
  active?: boolean;
}

const YYYY_MM_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidYearMonth(s: string): boolean {
  return YYYY_MM_PATTERN.test(s);
}

// "YYYY-MM" 比較：a <= b 回 true（字串比較即可，因為固定寬度）
export function ymLessOrEqual(a: string, b: string): boolean {
  return a <= b;
}

// 一筆定價在 [from, to]（YYYY-MM 範圍）內是否有任一月份生效。
// 視為區間重疊：max(p.from, from) <= min(p.to ?? +∞, to)
export function pricingOverlapsRange(
  pricing: Pick<ClassPricingDoc, 'effectiveFrom' | 'effectiveTo'>,
  from: string,
  to: string,
): boolean {
  const pFrom = pricing.effectiveFrom;
  const pTo = pricing.effectiveTo;
  if (pTo === null) return pFrom <= to;
  return pFrom <= to && pTo >= from;
}

// 取得在某個 YYYY-MM 該班生效的定價（可能多筆）。client 端使用。
export function isPricingActiveInMonth(
  pricing: Pick<ClassPricingDoc, 'effectiveFrom' | 'effectiveTo'>,
  ym: string,
): boolean {
  if (pricing.effectiveFrom > ym) return false;
  if (pricing.effectiveTo !== null && pricing.effectiveTo < ym) return false;
  return true;
}

// 顯示用：把 effectiveFrom / effectiveTo 拼成「2026-01 ~ 2026-06」或「2026-01 起」
export function formatEffectiveRange(
  pricing: Pick<ClassPricingDoc, 'effectiveFrom' | 'effectiveTo'>,
): string {
  if (pricing.effectiveTo === null) return `${pricing.effectiveFrom} 起`;
  return `${pricing.effectiveFrom} ~ ${pricing.effectiveTo}`;
}

// 校驗 + 正規化新增/編輯輸入。發現問題就 throw 中文訊息。
export function validatePricingDates(from: string, to: string | null | undefined): void {
  if (!from || !isValidYearMonth(from)) {
    throw new Error('生效起始月份格式錯誤（需為 YYYY-MM）');
  }
  if (to !== null && to !== undefined && to !== '') {
    if (!isValidYearMonth(to)) {
      throw new Error('生效結束月份格式錯誤（需為 YYYY-MM）');
    }
    if (!ymLessOrEqual(from, to)) {
      throw new Error('生效結束月份不可早於起始月份');
    }
  }
}
