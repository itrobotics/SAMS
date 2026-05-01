// survey_responses CRUD（F3）
//
// 設計：
//   - 管理員在場次結束後點「發送問卷」，為所有出席學員建立 pending 記錄
//   - 學員透過 /survey/:responseId 填寫（無需登入）
//   - 管理員可查詢某場次的統計 & 某學員的歷次記錄

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  SURVEY_RESPONSES_COLLECTION,
  makeSurveyResponseId,
  type SurveyResponseDoc,
} from '../types/survey';
import { type AttendanceRecordDoc } from '../types/attendance';

function responseRef(responseId: string) {
  return doc(db, SURVEY_RESPONSES_COLLECTION, responseId);
}

function snapshotToResponse(snap: {
  id: string;
  data: () => Record<string, unknown>;
}): SurveyResponseDoc {
  return { responseId: snap.id, ...(snap.data() as Omit<SurveyResponseDoc, 'responseId'>) };
}

// 為場次所有出席學員批次建立 pending 問卷記錄（idempotent：已存在則跳過）
export async function sendSurveyForSession(
  sessionId: string,
  classId: string,
  branchId: string,
  presentRecords: AttendanceRecordDoc[],
): Promise<number> {
  const batch = writeBatch(db);
  let count = 0;

  for (const record of presentRecords) {
    const responseId = makeSurveyResponseId(sessionId, record.studentId);
    const ref = responseRef(responseId);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      batch.set(ref, {
        sessionId,
        classId,
        branchId,
        studentId: record.studentId,
        studentName: record.studentName,
        answers: {},
        status: 'pending',
        submittedAt: null,
        createdAt: serverTimestamp(),
      });
      count++;
    }
  }

  await batch.commit();
  return count;
}

// 取得單筆問卷記錄（填寫頁用，無需 auth）
export async function fetchSurveyResponse(responseId: string): Promise<SurveyResponseDoc | null> {
  const snap = await getDoc(responseRef(responseId));
  if (!snap.exists()) return null;
  return snapshotToResponse(snap);
}

// 學員送出填答
export async function submitSurveyResponse(
  responseId: string,
  answers: Record<string, string>,
): Promise<void> {
  await updateDoc(responseRef(responseId), {
    answers,
    status: 'submitted',
    submittedAt: serverTimestamp(),
  });
}

// 訂閱某場次的所有問卷記錄（管理端統計用）
export function subscribeSessionSurveyResponses(
  sessionId: string,
  onChange: (responses: SurveyResponseDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, SURVEY_RESPONSES_COLLECTION),
    where('sessionId', '==', sessionId),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapshotToResponse)),
    (err) => onError?.(err),
  );
}

// 查詢某學員的歷次問卷填寫記錄（一次性，學生詳細頁用）
export async function fetchStudentSurveyHistory(
  studentId: string,
): Promise<SurveyResponseDoc[]> {
  const q = query(
    collection(db, SURVEY_RESPONSES_COLLECTION),
    where('studentId', '==', studentId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(snapshotToResponse)
    .sort((a, b) => {
      const ta = a.submittedAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0;
      const tb = b.submittedAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0;
      return tb - ta;
    });
}

// 計算某場次問卷統計
export interface SurveyStats {
  total: number;
  submitted: number;
  responseRate: number; // 0-1
  averages: Record<string, number | null>; // questionId → average (null if no data)
  yesNoCounts: Record<string, { yes: number; no: number; partial: number }>;
}

export function computeSurveyStats(
  responses: SurveyResponseDoc[],
  questionIds: number[],
  yesNoIds: number[],
): SurveyStats {
  const submitted = responses.filter((r) => r.status === 'submitted');
  const total = responses.length;

  const averages: Record<string, number | null> = {};
  const yesNoCounts: Record<string, { yes: number; no: number; partial: number }> = {};

  for (const qid of questionIds) {
    if (yesNoIds.includes(qid)) {
      const counts = { yes: 0, no: 0, partial: 0 };
      for (const r of submitted) {
        const val = r.answers[String(qid)];
        if (val === 'yes') counts.yes++;
        else if (val === 'no') counts.no++;
        else if (val === 'partial') counts.partial++;
      }
      yesNoCounts[String(qid)] = counts;
      averages[String(qid)] = null;
    } else {
      const vals = submitted
        .map((r) => Number(r.answers[String(qid)]))
        .filter((v) => v >= 1 && v <= 5);
      averages[String(qid)] =
        vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
  }

  return {
    total,
    submitted: submitted.length,
    responseRate: total > 0 ? submitted.length / total : 0,
    averages,
    yesNoCounts,
  };
}
