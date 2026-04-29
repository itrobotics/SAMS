// class_pricing CRUD
//
// 寫入：createClassPricing / updateClassPricing
// 查詢：subscribeClassPricing({ branchIds, classId?, activeOnly? })
//
// pricingId 自動產生（PRnnnnnn，6 位流水號）。autoId.ts 只支援 3 位，所以這裡內建 6 位版本。

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  CLASS_PRICING_COLLECTION,
  isValidPriceType,
  type ClassPricingDoc,
  type NewClassPricingInput,
  type UpdateClassPricingInput,
} from '../types/classPricing';

const PRICING_PREFIX = 'PR';
const PRICING_ID_PAD = 6;

function pricingRef(pricingId: string) {
  return doc(db, CLASS_PRICING_COLLECTION, pricingId);
}

function snapshotToPricing(snap: {
  id: string;
  data: () => Record<string, unknown>;
}): ClassPricingDoc {
  return { pricingId: snap.id, ...(snap.data() as Omit<ClassPricingDoc, 'pricingId'>) };
}

// 流水號產生器：掃 collection 找最大 PRnnnnnn 後 +1。
async function nextPricingId(): Promise<string> {
  const snap = await getDocs(collection(db, CLASS_PRICING_COLLECTION));
  const re = new RegExp(`^${PRICING_PREFIX}(\\d+)$`, 'i');
  let max = 0;
  snap.docs.forEach((d) => {
    const m = d.id.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  return `${PRICING_PREFIX}${String(max + 1).padStart(PRICING_ID_PAD, '0')}`;
}

interface SubscribePricingOptions {
  branchIds?: string[]; // undefined = HQ 看全部
  classId?: string;
  activeOnly?: boolean;
}

export function subscribeClassPricing(
  options: SubscribePricingOptions,
  onChange: (rows: ClassPricingDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const constraints = [];
  if (options.branchIds && options.branchIds.length > 0) {
    constraints.push(where('branchId', 'in', options.branchIds.slice(0, 30)));
  }
  if (options.classId) {
    constraints.push(where('classId', '==', options.classId));
  }
  if (options.activeOnly) {
    constraints.push(where('active', '==', true));
  }
  const q = query(collection(db, CLASS_PRICING_COLLECTION), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(snapshotToPricing);
      list.sort((a, b) => a.className.localeCompare(b.className));
      onChange(list);
    },
    (err) => onError?.(err),
  );
}

export async function createClassPricing(input: NewClassPricingInput): Promise<string> {
  if (!input.classId.trim()) throw new Error('請選擇班級');
  if (!input.branchId.trim()) throw new Error('班級缺少分校資料');
  if (!input.className.trim()) throw new Error('班級缺少名稱資料');
  if (!Number.isFinite(input.price) || input.price < 0) {
    throw new Error('定價必須為大於等於 0 的數字');
  }
  if (!isValidPriceType(input.priceType)) {
    throw new Error('計費方式錯誤');
  }

  const pricingId = await nextPricingId();

  await setDoc(pricingRef(pricingId), {
    classId: input.classId.trim(),
    branchId: input.branchId.trim(),
    className: input.className.trim(),
    price: input.price,
    priceType: input.priceType,
    notes: input.notes?.trim() ?? '',
    active: input.active ?? true,
    createdAt: serverTimestamp(),
    createdBy: input.createdBy,
  });
  return pricingId;
}

export async function updateClassPricing(
  pricingId: string,
  patch: UpdateClassPricingInput,
): Promise<void> {
  const cleaned: Record<string, unknown> = {};
  if (patch.classId !== undefined) cleaned.classId = patch.classId.trim();
  if (patch.branchId !== undefined) cleaned.branchId = patch.branchId.trim();
  if (patch.className !== undefined) cleaned.className = patch.className.trim();
  if (patch.price !== undefined) {
    if (!Number.isFinite(patch.price) || patch.price < 0) {
      throw new Error('定價必須為大於等於 0 的數字');
    }
    cleaned.price = patch.price;
  }
  if (patch.priceType !== undefined) {
    if (!isValidPriceType(patch.priceType)) throw new Error('計費方式錯誤');
    cleaned.priceType = patch.priceType;
  }
  if (patch.notes !== undefined) cleaned.notes = patch.notes.trim();
  if (patch.active !== undefined) cleaned.active = patch.active;

  if (Object.keys(cleaned).length === 0) return;
  await updateDoc(pricingRef(pricingId), cleaned);
}

export async function setClassPricingActive(pricingId: string, active: boolean): Promise<void> {
  await updateDoc(pricingRef(pricingId), { active });
}
