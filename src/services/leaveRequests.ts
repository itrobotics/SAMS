// leave_requests 查詢（Task 045）

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import { LEAVE_REQUESTS_COLLECTION, type LeaveRequestDoc } from '../types/leaveRequest';

function snapshotToLeave(snap: { id: string; data: () => Record<string, unknown> }): LeaveRequestDoc {
  return { leaveId: snap.id, ...(snap.data() as Omit<LeaveRequestDoc, 'leaveId'>) };
}

export function subscribeLeaveRequestsForStudent(
  studentId: string,
  onChange: (requests: LeaveRequestDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, LEAVE_REQUESTS_COLLECTION),
    where('studentId', '==', studentId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapshotToLeave)),
    (err) => onError?.(err),
  );
}
