// branches CRUD（Task 008） + realtime listener（給 Task 009 用）

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  BRANCHES_COLLECTION,
  isValidBranchId,
  type BranchDoc,
  type NewBranchInput,
  type UpdateBranchInput,
} from '../types/branch';

function branchRef(branchId: string) {
  return doc(db, BRANCHES_COLLECTION, branchId);
}

function snapshotToBranch(snap: { id: string; data: () => Record<string, unknown> }): BranchDoc {
  return { branchId: snap.id, ...(snap.data() as Omit<BranchDoc, 'branchId'>) };
}

export async function fetchBranch(branchId: string): Promise<BranchDoc | null> {
  const snap = await getDoc(branchRef(branchId));
  if (!snap.exists()) return null;
  return snapshotToBranch(snap);
}

export function subscribeBranches(
  onChange: (branches: BranchDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(collection(db, BRANCHES_COLLECTION), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapshotToBranch)),
    (err) => onError?.(err),
  );
}

export async function createBranch(input: NewBranchInput): Promise<void> {
  const branchId = input.branchId.trim().toLowerCase();
  if (!isValidBranchId(branchId)) {
    throw new Error('分校代碼格式錯誤（僅限小寫英數與「-」，2-30 字元）');
  }
  const existing = await getDoc(branchRef(branchId));
  if (existing.exists()) {
    throw new Error(`分校代碼「${branchId}」已存在`);
  }
  await setDoc(branchRef(branchId), {
    name: input.name.trim(),
    address: input.address?.trim() ?? '',
    servicePhone: input.servicePhone?.trim() ?? '',
    directorName: input.directorName?.trim() ?? '',
    directorPhone: input.directorPhone?.trim() ?? '',
    directorLineId: input.directorLineId?.trim() ?? '',
    notes: input.notes?.trim() ?? '',
    status: 'active',
    createdAt: serverTimestamp(),
  });
}

export async function updateBranch(branchId: string, patch: UpdateBranchInput): Promise<void> {
  const cleaned: Record<string, unknown> = {};
  if (patch.name !== undefined) cleaned.name = patch.name.trim();
  if (patch.address !== undefined) cleaned.address = patch.address.trim();
  if (patch.servicePhone !== undefined) cleaned.servicePhone = patch.servicePhone.trim();
  if (patch.directorName !== undefined) cleaned.directorName = patch.directorName.trim();
  if (patch.directorPhone !== undefined) cleaned.directorPhone = patch.directorPhone.trim();
  if (patch.directorLineId !== undefined) cleaned.directorLineId = patch.directorLineId.trim();
  if (patch.notes !== undefined) cleaned.notes = patch.notes.trim();
  if (patch.status !== undefined) cleaned.status = patch.status;
  if (Object.keys(cleaned).length === 0) return;
  await updateDoc(branchRef(branchId), cleaned);
}

export async function setBranchStatus(branchId: string, status: 'active' | 'disabled'): Promise<void> {
  await updateDoc(branchRef(branchId), { status });
}
