// 分校設定讀取（Task 027 預備 + Phase 14 完整實作）
//
// 取不到設定 → 回傳預設值，不阻塞報到流程。

import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';

import { db } from './firebase';
import {
  DEFAULT_BRANCH_SETTINGS,
  SETTINGS_COLLECTION,
  type BranchSettings,
} from '../types/settings';

export async function fetchBranchSettings(branchId: string): Promise<BranchSettings> {
  const snap = await getDoc(doc(db, SETTINGS_COLLECTION, branchId));
  if (!snap.exists()) {
    return { branchId, ...DEFAULT_BRANCH_SETTINGS };
  }
  return { branchId, ...DEFAULT_BRANCH_SETTINGS, ...(snap.data() as Partial<BranchSettings>) };
}

export function subscribeBranchSettings(
  branchId: string,
  onChange: (s: BranchSettings) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, SETTINGS_COLLECTION, branchId),
    (snap) => {
      if (!snap.exists()) {
        onChange({ branchId, ...DEFAULT_BRANCH_SETTINGS });
        return;
      }
      onChange({ branchId, ...DEFAULT_BRANCH_SETTINGS, ...(snap.data() as Partial<BranchSettings>) });
    },
    (err) => onError?.(err),
  );
}
