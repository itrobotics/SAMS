// branches collection 型別定義（Task 008）
//
// Firestore 路徑：`branches/{branchId}`，branchId 為使用者指定的英數短代碼
// （如 "anhe", "dazhi"），同時作為 doc ID 與其他 collection 的 foreign key。

import type { Timestamp } from 'firebase/firestore';

export type BranchStatus = 'active' | 'disabled';

export interface BranchDoc {
  branchId: string;
  name: string;
  address: string;
  status: BranchStatus;
  createdAt?: Timestamp;
}

export interface NewBranchInput {
  branchId: string;
  name: string;
  address?: string;
}

export interface UpdateBranchInput {
  name?: string;
  address?: string;
  status?: BranchStatus;
}

export const BRANCHES_COLLECTION = 'branches';

// 小寫英數與連字號，2-30 字元；避免特殊符號污染 doc 路徑
const BRANCH_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,29}$/;

export function isValidBranchId(id: string): boolean {
  return BRANCH_ID_PATTERN.test(id);
}
