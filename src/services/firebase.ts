// Firebase 初始化（Task 003）
// Project ID: ithink-sams

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAnalytics, isSupported as isAnalyticsSupported, type Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyDhkUU_bai8EkNZ-40jSiNChYKkQESyROg',
  authDomain: 'ithink-sams.firebaseapp.com',
  projectId: 'ithink-sams',
  storageBucket: 'ithink-sams.firebasestorage.app',
  messagingSenderId: '173406480654',
  appId: '1:173406480654:web:c2cee2b3c7b0ef10a80f5f',
  measurementId: 'G-5ZXXHFBFDK',
};

export const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Analytics 僅在支援的瀏覽器環境啟用（避免 SSR / 測試環境噴錯）
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {
      analytics = null;
    });
}

export const PROJECT_ID = firebaseConfig.projectId;
