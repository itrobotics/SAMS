// face_profiles CRUD（Task 032）
//
// 寫入：createFaceProfile（addDoc 自動 ID）
// 查詢：subscribeStudentFaceProfiles / listActiveProfilesForStudents
// 軟刪：setFaceProfileActive(false)；同時 Storage 上的圖片不立即刪
//        （考慮日後重 train 模型可能還用得到；管理頁可手動清）

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
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
  FACE_EMBEDDING_LENGTH,
  FACE_PROFILES_COLLECTION,
  type FaceProfileDoc,
} from '../types/faceProfile';

function profileRef(profileId: string) {
  return doc(db, FACE_PROFILES_COLLECTION, profileId);
}

function snapshotToProfile(snap: { id: string; data: () => Record<string, unknown> }): FaceProfileDoc {
  return { profileId: snap.id, ...(snap.data() as Omit<FaceProfileDoc, 'profileId'>) };
}

export interface CreateFaceProfileInput {
  studentId: string;
  branchId: string;
  photoPath: string;
  embedding: number[];
  qualityScore: number;
}

export async function createFaceProfile(input: CreateFaceProfileInput): Promise<string> {
  if (input.embedding.length !== FACE_EMBEDDING_LENGTH) {
    throw new Error(`embedding 長度錯誤（預期 ${FACE_EMBEDDING_LENGTH}，實際 ${input.embedding.length}）`);
  }
  const ref = await addDoc(collection(db, FACE_PROFILES_COLLECTION), {
    studentId: input.studentId,
    branchId: input.branchId,
    photoPath: input.photoPath,
    embedding: input.embedding,
    qualityScore: input.qualityScore,
    active: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function setFaceProfileActive(profileId: string, active: boolean): Promise<void> {
  await updateDoc(profileRef(profileId), { active });
}

export async function deleteFaceProfile(profileId: string): Promise<void> {
  await deleteDoc(profileRef(profileId));
}

export function subscribeStudentFaceProfiles(
  studentId: string,
  onChange: (profiles: FaceProfileDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, FACE_PROFILES_COLLECTION),
    where('studentId', '==', studentId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapshotToProfile)),
    (err) => onError?.(err),
  );
}

// 一次性查詢：給 Kiosk 比對時用 — 抓某分校 + 一組學生 ID 的所有 active 照片。
// Firestore in 限 30 個值，學生若超過要分批呼叫並合併。
export async function listActiveProfilesForStudents(
  branchId: string,
  studentIds: string[],
): Promise<FaceProfileDoc[]> {
  if (studentIds.length === 0) return [];
  const out: FaceProfileDoc[] = [];
  for (let i = 0; i < studentIds.length; i += 30) {
    const chunk = studentIds.slice(i, i + 30);
    const q = query(
      collection(db, FACE_PROFILES_COLLECTION),
      where('branchId', '==', branchId),
      where('studentId', 'in', chunk),
      where('active', '==', true),
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) => out.push(snapshotToProfile(d)));
  }
  return out;
}
