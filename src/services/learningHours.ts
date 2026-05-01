// 學習時數計算服務
//
// 規則：只計算 status = CHECKED_IN 或 LATE 的場次。
// 時數來源：對應 SessionDoc 的 endTime - startTime（分鐘換算為小時）。

import {
  collection,
  documentId,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

import { db } from './firebase';
import { ATTENDANCE_RECORDS_COLLECTION, type AttendanceRecordDoc } from '../types/attendance';
import { SESSIONS_COLLECTION, type SessionDoc } from '../types/session';
import { timeToMinutes } from '../utils/date';

export function calcSessionDurationHours(startTime: string, endTime: string): number {
  return Math.max(0, (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60);
}

export function calcStudentLearningHours(
  records: AttendanceRecordDoc[],
  sessionsById: Map<string, SessionDoc>,
): number {
  let total = 0;
  for (const rec of records) {
    if (rec.status !== 'CHECKED_IN' && rec.status !== 'LATE') continue;
    const session = sessionsById.get(rec.sessionId);
    if (!session) continue;
    total += calcSessionDurationHours(session.startTime, session.endTime);
  }
  return total;
}

// Firestore in-query 最多 30 個值，分批查詢
export async function fetchSessionsByIds(sessionIds: string[]): Promise<Map<string, SessionDoc>> {
  const map = new Map<string, SessionDoc>();
  if (sessionIds.length === 0) return map;
  const unique = Array.from(new Set(sessionIds));
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    const snap = await getDocs(
      query(collection(db, SESSIONS_COLLECTION), where(documentId(), 'in', chunk)),
    );
    for (const d of snap.docs) {
      map.set(d.id, { sessionId: d.id, ...(d.data() as Omit<SessionDoc, 'sessionId'>) });
    }
  }
  return map;
}

// 一次性取得某學生的累計學習時數（給列表頁用）
export async function fetchStudentLearningHours(studentId: string): Promise<number> {
  const recSnap = await getDocs(
    query(
      collection(db, ATTENDANCE_RECORDS_COLLECTION),
      where('studentId', '==', studentId),
      orderBy('sessionId', 'desc'),
    ),
  );
  const records = recSnap.docs.map((d) => ({
    recordId: d.id,
    ...(d.data() as Omit<AttendanceRecordDoc, 'recordId'>),
  })) as AttendanceRecordDoc[];

  const presentRecords = records.filter(
    (r) => r.status === 'CHECKED_IN' || r.status === 'LATE',
  );
  const sessionIds = Array.from(new Set(presentRecords.map((r) => r.sessionId)));
  const sessionsById = await fetchSessionsByIds(sessionIds);
  return calcStudentLearningHours(presentRecords, sessionsById);
}
