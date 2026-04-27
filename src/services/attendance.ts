// attendance_records 查詢與更新（Task 021）
//
// 寫入主要來源：
//   1) 場次產生器（Task 022）：批次以 SCHEDULED 建立每位學生的紀錄
//   2) 手動報到（Task 026）：updateAttendanceStatus 改變 status / method / checkinTime
//   3) 人臉報到（Phase 9）：未來補上 method='FACE' / confidence

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  ATTENDANCE_RECORDS_COLLECTION,
  type AttendanceMethod,
  type AttendanceRecordDoc,
  type AttendanceStatus,
} from '../types/attendance';

function recRef(recordId: string) {
  return doc(db, ATTENDANCE_RECORDS_COLLECTION, recordId);
}

function snapshotToRec(snap: { id: string; data: () => Record<string, unknown> }): AttendanceRecordDoc {
  return { recordId: snap.id, ...(snap.data() as Omit<AttendanceRecordDoc, 'recordId'>) };
}

export function subscribeAttendanceForSession(
  sessionId: string,
  onChange: (records: AttendanceRecordDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, ATTENDANCE_RECORDS_COLLECTION),
    where('sessionId', '==', sessionId),
    orderBy('studentName', 'asc'),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapshotToRec)),
    (err) => onError?.(err),
  );
}

export function subscribeAttendanceForBranchDate(
  branchId: string,
  date: string, // 用 sessionId prefix 篩選不太實用，改為直接 where date
  onChange: (records: AttendanceRecordDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  // attendance_records 沒有 date 欄位，但 sessionId 以 YYYYMMDD 開頭。
  // 改用 branchId + sessionId range query：sessionId 範圍 [YYYYMMDD_, YYYYMMDD`]
  const compact = date.split('-').join('');
  const startId = `${compact}_`;
  const endId = `${compact}` + '`'; // ASCII '`' 在 '_' 之後
  const q = query(
    collection(db, ATTENDANCE_RECORDS_COLLECTION),
    where('branchId', '==', branchId),
    where('sessionId', '>=', startId),
    where('sessionId', '<', endId),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapshotToRec)),
    (err) => onError?.(err),
  );
}

export function subscribeAttendanceForStudent(
  studentId: string,
  limitDays: number, // 不透過 Firestore limit；前端切片即可
  onChange: (records: AttendanceRecordDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, ATTENDANCE_RECORDS_COLLECTION),
    where('studentId', '==', studentId),
    orderBy('sessionId', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapshotToRec).slice(0, limitDays * 5)),
    (err) => onError?.(err),
  );
}

interface UpdateAttendanceInput {
  status: AttendanceStatus;
  method?: AttendanceMethod | null;
  confidence?: number | null;
  operatorId?: string | null;
  // 是否同時把 checkinTime 設為現在；call site 控制
  setCheckinNow?: boolean;
  clearCheckin?: boolean;
}

export async function updateAttendance(
  recordId: string,
  patch: UpdateAttendanceInput,
): Promise<void> {
  const cleaned: Record<string, unknown> = { status: patch.status };
  if (patch.method !== undefined) cleaned.method = patch.method;
  if (patch.confidence !== undefined) cleaned.confidence = patch.confidence;
  if (patch.operatorId !== undefined) cleaned.operatorId = patch.operatorId;
  if (patch.setCheckinNow) cleaned.checkinTime = serverTimestamp();
  if (patch.clearCheckin) cleaned.checkinTime = null;
  await updateDoc(recRef(recordId), cleaned);
}
