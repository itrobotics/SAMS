// leave_requests 服務層（Phase 11 / M08）
//
// 寫入路徑：
//   1) SessionPage「請假」按鈕 → createLeaveRequest（建立時直接 status='approved'）
//      同時把 attendance_records 狀態改為 LEAVE。
//   2) 未來若加入家長端：可建立 status='pending' 後由行政呼叫 approveLeaveRequest /
//      rejectLeaveRequest 處理。
//
// 查詢：
//   - subscribeLeaveRequestsForStudent：StudentDetailPage 學生請假歷程
//   - subscribeLeaveRequestsForSession：SessionPage 顯示已請假的學生列表（如需）

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import { updateAttendance } from './attendance';
import { makeRecordId } from '../types/attendance';
import {
  LEAVE_REQUESTS_COLLECTION,
  type LeaveRequestDoc,
  type NewLeaveRequestInput,
} from '../types/leaveRequest';

function leaveRef(leaveId: string) {
  return doc(db, LEAVE_REQUESTS_COLLECTION, leaveId);
}

function snapToDoc(snap: { id: string; data: () => Record<string, unknown> }): LeaveRequestDoc {
  return { leaveId: snap.id, ...(snap.data() as Omit<LeaveRequestDoc, 'leaveId'>) };
}

// 產生新 leaveId：LV + 6 碼遞增（向 collection 內現有 ID 取 max）。
async function nextLeaveId(): Promise<string> {
  const snap = await getDocs(collection(db, LEAVE_REQUESTS_COLLECTION));
  const re = /^LV(\d+)$/i;
  let max = 0;
  snap.docs.forEach((d) => {
    const m = d.id.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  return `LV${String(max + 1).padStart(6, '0')}`;
}

/**
 * 建立請假紀錄。若 status === 'approved'，同時把 attendance_records 改為 LEAVE。
 * leaveId 會自動產生（如果 input 沒帶）。
 */
export async function createLeaveRequest(
  input: Omit<NewLeaveRequestInput, 'leaveId'> & { leaveId?: string },
): Promise<string> {
  const leaveId = input.leaveId ?? (await nextLeaveId());
  const payload: Omit<LeaveRequestDoc, 'leaveId'> = {
    studentId: input.studentId,
    studentName: input.studentName,
    branchId: input.branchId,
    classId: input.classId,
    sessionId: input.sessionId,
    sessionDate: input.sessionDate,
    className: input.className,
    reason: input.reason,
    status: input.status,
    operatorId: input.operatorId,
    approvedBy: input.status === 'approved' ? input.operatorId : null,
    decidedAt: null,
  };
  await setDoc(leaveRef(leaveId), {
    ...payload,
    createdAt: serverTimestamp(),
    ...(input.status === 'approved' ? { decidedAt: serverTimestamp() } : {}),
  });

  if (input.status === 'approved') {
    await updateAttendance(makeRecordId(input.sessionId, input.studentId), {
      status: 'LEAVE',
      method: null,
      confidence: null,
      operatorId: input.operatorId ?? null,
      clearCheckin: true,
    });
  }

  return leaveId;
}

/**
 * 核准請假：寫 leave_request.status='approved'，並把對應 attendance_records 改 LEAVE。
 */
export async function approveLeaveRequest(
  leave: LeaveRequestDoc,
  approverId: string | null,
): Promise<void> {
  await updateDoc(leaveRef(leave.leaveId), {
    status: 'approved',
    approvedBy: approverId,
    decidedAt: serverTimestamp(),
  });
  await updateAttendance(makeRecordId(leave.sessionId, leave.studentId), {
    status: 'LEAVE',
    method: null,
    confidence: null,
    operatorId: approverId,
    clearCheckin: true,
  });
}

/**
 * 拒絕請假：只更新 leave_request 自身；attendance 維持原本狀態（行政可手動改）。
 */
export async function rejectLeaveRequest(
  leaveId: string,
  approverId: string | null,
): Promise<void> {
  await updateDoc(leaveRef(leaveId), {
    status: 'rejected',
    approvedBy: approverId,
    decidedAt: serverTimestamp(),
  });
}

export function subscribeLeaveRequestsForStudent(
  studentId: string,
  onChange: (list: LeaveRequestDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, LEAVE_REQUESTS_COLLECTION),
    where('studentId', '==', studentId),
    orderBy('sessionDate', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapToDoc)),
    (err) => onError?.(err),
  );
}

export function subscribeLeaveRequestsForSession(
  sessionId: string,
  onChange: (list: LeaveRequestDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, LEAVE_REQUESTS_COLLECTION),
    where('sessionId', '==', sessionId),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapToDoc)),
    (err) => onError?.(err),
  );
}
