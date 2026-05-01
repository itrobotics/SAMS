// leave_requests collection 型別定義（Task 045）
//
// Firestore 路徑：`leave_requests/{leaveId}`
// leaveId 由 addDoc 自動產生。

import type { Timestamp } from 'firebase/firestore';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequestDoc {
  leaveId: string;
  studentId: string;
  branchId: string;
  sessionId: string;
  reason: string;
  status: LeaveStatus;
  createdAt: Timestamp;
  approvedBy: string | null;
}

export const LEAVE_REQUESTS_COLLECTION = 'leave_requests';

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: '待審核',
  approved: '已核准',
  rejected: '已拒絕',
};

export const LEAVE_STATUS_COLORS: Record<LeaveStatus, { bg: string; text: string }> = {
  pending: { bg: '#fef9c3', text: '#854d0e' },
  approved: { bg: '#dcfce7', text: '#166534' },
  rejected: { bg: '#fee2e2', text: '#b91c1c' },
};
