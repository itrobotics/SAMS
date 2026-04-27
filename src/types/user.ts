// users collection 型別定義（Task 006）
//
// Firestore 實際路徑：`users/{userId}`，userId === Firebase Auth uid。
// branchIds：HQ_ADMIN 通常為空陣列（代表全部分校），其他角色至少需有一筆。

import type { Timestamp } from 'firebase/firestore';

export const USER_ROLES = ['hq_admin', 'branch_admin', 'teacher', 'staff'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface UserDoc {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  branchIds: string[];
  active: boolean;
  createdAt?: Timestamp;
}

export const USERS_COLLECTION = 'users';

// HQ 視為可進入所有分校；其他角色僅限 branchIds 內。
export function canAccessBranch(user: UserDoc, branchId: string): boolean {
  if (!user.active) return false;
  if (user.role === 'hq_admin') return true;
  return user.branchIds.includes(branchId);
}

export function defaultLandingPath(user: UserDoc): string {
  if (user.role === 'hq_admin') return '/hq-dashboard';
  const firstBranch = user.branchIds[0];
  if (!firstBranch) return '/login';
  return `/branch-dashboard/${firstBranch}`;
}
