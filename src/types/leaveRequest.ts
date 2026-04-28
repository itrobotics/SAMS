// leave_requests collection 型別定義（Phase 11 / M08）
//
// Firestore 路徑：`leave_requests/{leaveId}`
// 行政在 SessionPage 上點「請假」會建立一筆 leave_request（status='approved'，即時生效），
// 同時把該場次該學生的 attendance_records 狀態改為 LEAVE。
// 之後若需要家長/學生自助申請流程，可改成先 'pending' → 行政再 approve/reject。

import type { Timestamp } from 'firebase/firestore';

export const LEAVE_REQUESTS_COLLECTION = 'leave_requests';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: '待審',
  approved: '已核准',
  rejected: '已拒絕',
};

export const LEAVE_STATUS_COLORS: Record<LeaveStatus, { bg: string; fg: string }> = {
  pending:  { bg: '#fef3c7', fg: '#92400e' },
  approved: { bg: '#dbeafe', fg: '#1e40af' },
  rejected: { bg: '#fee2e2', fg: '#b91c1c' },
};

export interface LeaveRequestDoc {
  leaveId: string;
  studentId: string;
  studentName: string;   // 反正規化，方便列表顯示
  branchId: string;
  classId: string;
  sessionId: string;
  sessionDate: string;   // 反正規化 sessions.date，列表用
  className: string;     // 反正規化，列表用
  reason: string;
  status: LeaveStatus;
  createdAt?: Timestamp;
  operatorId: string | null;       // 登錄人（建立時）
  approvedBy: string | null;       // 核准/拒絕人
  decidedAt: Timestamp | null;     // 核准/拒絕時間
}

export type NewLeaveRequestInput = Omit<
  LeaveRequestDoc,
  'createdAt' | 'approvedBy' | 'decidedAt'
>;
