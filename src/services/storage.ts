// Firebase Storage 包裝（Task 033）
//
// 規格的 Storage 路徑：
//   /branches/{branchId}/students/{studentId}/photo1.jpg
//   /branches/{branchId}/students/{studentId}/photo2.jpg
//
// 為避免命名衝突 + 同學生上傳多張，實際 path 加上時間戳後綴：
//   /branches/{branchId}/students/{studentId}/face_photos/{ts}_{rand}.jpg
//
// 上傳一律 image/jpeg；副檔名固定 .jpg 方便 Console 預覽。

import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';

import { storage } from './firebase';

export function studentPhotoFolder(branchId: string, studentId: string): string {
  return `branches/${branchId}/students/${studentId}/face_photos`;
}

export function makePhotoPath(branchId: string, studentId: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${studentPhotoFolder(branchId, studentId)}/${ts}_${rand}.jpg`;
}

// 上傳一張學生人臉照，回傳 Storage path（給 face_profiles.photoPath 用）。
export async function uploadStudentFacePhoto(args: {
  branchId: string;
  studentId: string;
  blob: Blob;
}): Promise<{ path: string; size: number }> {
  const path = makePhotoPath(args.branchId, args.studentId);
  const r = storageRef(storage, path);
  const result = await uploadBytes(r, args.blob, {
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000', // 永久快取（檔名含時間戳，不會撞）
  });
  return { path, size: result.metadata.size ?? args.blob.size };
}

// 取得縮圖 / 預覽圖的下載網址。Storage rules 設定為「需登入」即可保護隱私。
export async function getPhotoUrl(path: string): Promise<string> {
  return getDownloadURL(storageRef(storage, path));
}

export async function deletePhoto(path: string): Promise<void> {
  await deleteObject(storageRef(storage, path));
}
