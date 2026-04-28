// face_checkin_attempts 寫入 / 查詢（Task 041）

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { db } from './firebase';
import {
  FACE_CHECKIN_ATTEMPTS_COLLECTION,
  type FaceAttemptResult,
} from '../types/faceCheckinAttempt';

interface LogAttemptInput {
  branchId: string;
  sessionId: string | null;
  deviceId: string;
  matchedStudentId: string | null;
  matchedStudentName: string | null;
  confidence: number | null;
  result: FaceAttemptResult;
  scopeProfileCount: number;
  operatorId: string | null;
}

export async function logFaceAttempt(input: LogAttemptInput): Promise<void> {
  // log 寫入失敗不該擋住報到流程 — 包一層 try
  try {
    await addDoc(collection(db, FACE_CHECKIN_ATTEMPTS_COLLECTION), {
      ...input,
      confidence: input.confidence === null ? null : Number(input.confidence.toFixed(4)),
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[face] logFaceAttempt failed:', e);
  }
}

// 簡易裝置識別：拿 navigator.userAgent 哈希前 12 字。
// 不是真正唯一裝置 ID，但可以區分「同一台 Kiosk 機」與「另一台」。
export function deriveDeviceId(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'server';
  let hash = 0;
  for (let i = 0; i < ua.length; i++) {
    hash = ((hash << 5) - hash) + ua.charCodeAt(i);
    hash |= 0;
  }
  return `kiosk_${Math.abs(hash).toString(36).slice(0, 12)}`;
}
