// 一次性 seed 腳本：用 Firebase Auth REST API 建立 HQ admin 帳號，
// 並透過 Firestore REST API 寫入 users/{uid} 文件。
// 用 idToken 當 Bearer，這樣即使 Firestore rules 鎖死非登入寫入也能通過。

import { setTimeout as wait } from 'node:timers/promises';

const API_KEY = 'AIzaSyDhkUU_bai8EkNZ-40jSiNChYKkQESyROg';
const PROJECT_ID = 'ithink-sams';
const EMAIL = 'admin@ithink-sams.com';
const PASSWORD = 'Sams2026!';
const NAME = 'HQ Admin';

async function api(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
  if (!res.ok) {
    const msg = json?.error?.message ?? text ?? `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, body: json ?? text });
  }
  return json;
}

async function signUp() {
  return api(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    },
  );
}

async function signIn() {
  return api(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    },
  );
}

async function ensureUser() {
  try {
    const r = await signUp();
    return { uid: r.localId, idToken: r.idToken, created: true };
  } catch (e) {
    if (e.status === 400 && /EMAIL_EXISTS/i.test(e.message)) {
      const r = await signIn();
      return { uid: r.localId, idToken: r.idToken, created: false };
    }
    throw e;
  }
}

async function writeUserDoc(uid, idToken) {
  // PATCH = upsert specific fields. 用 documentPath 模式直接寫到 users/{uid}
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  const body = {
    fields: {
      userId:    { stringValue: uid },
      name:      { stringValue: NAME },
      email:     { stringValue: EMAIL },
      role:      { stringValue: 'hq_admin' },
      branchIds: { arrayValue: { values: [] } },
      active:    { booleanValue: true },
      createdAt: { timestampValue: new Date().toISOString() },
    },
  };
  return api(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
}

(async () => {
  console.log('1) Auth REST API: signUp / signIn ...');
  const { uid, idToken, created } = await ensureUser();
  console.log(`   → uid = ${uid}  (${created ? 'CREATED' : 'EXISTING'})`);

  // Firestore 偶爾會 throttle 剛創出來的 token；等 0.5s 再寫
  await wait(500);

  console.log('2) Firestore REST API: writing users/' + uid + ' ...');
  const doc = await writeUserDoc(uid, idToken);
  console.log('   → updateTime =', doc.updateTime);

  console.log('\n=== DONE ===');
  console.log('email   :', EMAIL);
  console.log('password:', PASSWORD);
  console.log('uid     :', uid);
  console.log('role    : hq_admin');
})().catch((e) => {
  console.error('FAILED:', e.message);
  if (e.body) console.error(JSON.stringify(e.body, null, 2));
  process.exit(1);
});
