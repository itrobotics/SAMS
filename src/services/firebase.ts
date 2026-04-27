// Firebase 初始化模組（Task 002 模板 → Task 003 實際串接）
//
// 本檔案提供 Firebase config 解析框架。實際的 initializeApp / Firestore /
// Auth / Storage 初始化將在 Task 003 加入。
//
// 環境變數請參考根目錄 `.env.example`。

interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function readFirebaseEnv(): FirebaseEnvConfig {
  const env = import.meta.env;
  const config: FirebaseEnvConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };

  const missing = (Object.keys(config) as Array<keyof FirebaseEnvConfig>)
    .filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `[SAMS] 缺少 Firebase 環境變數：${missing
        .map((k) => `VITE_FIREBASE_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`)
        .join(', ')}\n` +
        '請參考 .env.example 建立 .env',
    );
  }

  return config;
}

export const firebaseConfig = readFirebaseEnv;
