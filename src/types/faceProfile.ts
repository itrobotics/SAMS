// face_profiles collection 型別定義（Task 032）
//
// Firestore 路徑：`face_profiles/{profileId}`
// - profileId 自動產生（Firestore auto-id）
// - 同一學生可有多筆（spec：每位學生可上傳 3-5 張照片）
// - embedding：face-api.js 產生的 128 維 Float32Array → 存成 number[]
//   - 規格書原訂 Python face_recognition；實作改用 face-api.js（同樣 128-D）
// - photoPath：對應 Firebase Storage 路徑，用 getDownloadURL 取縮圖
// - qualityScore：face-api.js detection 的 score（0-1，越高越好）

import type { Timestamp } from 'firebase/firestore';

export interface FaceProfileDoc {
  profileId: string;
  studentId: string;
  branchId: string;
  photoPath: string;       // Storage 路徑（含 jpg 副檔名）
  embedding: number[];     // 長度固定 128（face-api.js）
  qualityScore: number;    // 0-1
  active: boolean;
  createdAt?: Timestamp;
}

export const FACE_PROFILES_COLLECTION = 'face_profiles';
export const FACE_EMBEDDING_LENGTH = 128;

// 計算兩個 embedding 的 Euclidean distance（face-api.js 慣例）
// 距離越小代表越像；face-api.js 一般用 0.6 為 same-person 門檻。
// 這個函數放在 types 不放 utils，是因為 face_profiles 與 distance 是強耦合概念。
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`embedding 長度不一致：${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

// distance → spec 規格的「信心值」（0-1，1 最像）。
// spec 用 0.85 / 0.70 為門檻；換算公式 confidence = max(0, 1 - distance)。
// 一般 face-api.js 距離 0.4 ⇒ confidence 0.60，距離 0.15 ⇒ confidence 0.85。
export function distanceToConfidence(distance: number): number {
  return Math.max(0, Math.min(1, 1 - distance));
}
