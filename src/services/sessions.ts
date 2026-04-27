// sessions 查詢與更新（Task 020）
//
// 寫入主要透過 Task 022 的場次產生器（services/sessionGenerator.ts）統一處理。
// 這裡提供查詢、訂閱、更新狀態的 API。

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import { SESSIONS_COLLECTION, type SessionDoc, type SessionStatus } from '../types/session';

function sessionRef(sessionId: string) {
  return doc(db, SESSIONS_COLLECTION, sessionId);
}

function snapshotToSession(snap: { id: string; data: () => Record<string, unknown> }): SessionDoc {
  return { sessionId: snap.id, ...(snap.data() as Omit<SessionDoc, 'sessionId'>) };
}

export async function fetchSession(sessionId: string): Promise<SessionDoc | null> {
  const snap = await getDoc(sessionRef(sessionId));
  if (!snap.exists()) return null;
  return snapshotToSession(snap);
}

export function subscribeSession(
  sessionId: string,
  onChange: (s: SessionDoc | null) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    sessionRef(sessionId),
    (snap) => onChange(snap.exists() ? snapshotToSession(snap) : null),
    (err) => onError?.(err),
  );
}

interface SubscribeSessionsOptions {
  branchId: string;
  date: string; // "YYYY-MM-DD"
}

export function subscribeSessionsForBranchDate(
  { branchId, date }: SubscribeSessionsOptions,
  onChange: (sessions: SessionDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, SESSIONS_COLLECTION),
    where('branchId', '==', branchId),
    where('date', '==', date),
    orderBy('startTime', 'asc'),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapshotToSession)),
    (err) => onError?.(err),
  );
}

export async function setSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
  await updateDoc(sessionRef(sessionId), { status });
}
