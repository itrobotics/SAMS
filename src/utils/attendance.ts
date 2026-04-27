// 報到狀態判定（Task 027）
//
// 規則：報到時間（now）相對於 session.startTime
//   - now <= start + graceMinutes  → CHECKED_IN
//   - now >  start + graceMinutes  → LATE
//
// session.startTime 為 "HH:mm"；以「該日該時」做判斷。
// 若是補打（前幾天的場次），now 會遠大於 start → 視為 LATE 是合理的。

import { timeToMinutes } from './date';
import type { AttendanceStatus } from '../types/attendance';

export function decideManualCheckinStatus(
  now: Date,
  sessionDateISO: string,
  sessionStartTime: string,
  graceMinutes: number,
): Extract<AttendanceStatus, 'CHECKED_IN' | 'LATE'> {
  const [y, m, d] = sessionDateISO.split('-').map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return 'CHECKED_IN'; // 異常日期：保守視為準時

  const startBoundary = new Date(y, m - 1, d);
  startBoundary.setMinutes(timeToMinutes(sessionStartTime) + graceMinutes);

  return now.getTime() <= startBoundary.getTime() ? 'CHECKED_IN' : 'LATE';
}
