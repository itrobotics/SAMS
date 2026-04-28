// 用 firebase CLI 的 refresh token 換 access token，呼叫 Identity Toolkit
// Admin API 啟用 Email/Password provider，然後再跑 seed-admin。

import { readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PROJECT_ID = 'ithink-sams';
const STORE = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');

const cs = JSON.parse(readFileSync(STORE, 'utf8'));
const refresh = cs.tokens?.refresh_token;
if (!refresh) {
  console.error('No refresh_token in', STORE);
  process.exit(2);
}

// firebase-tools 的 OAuth client（公開常數 — firebase CLI 開源代碼裡寫死的）
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

console.log('1) Exchanging refresh_token for access_token ...');
const tokRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }),
});
const tok = await tokRes.json();
if (!tokRes.ok) {
  console.error('Token exchange failed:', tok);
  process.exit(3);
}
const accessToken = tok.access_token;
console.log('   → got access_token (len=' + accessToken.length + '), expires_in=' + tok.expires_in);

// PATCH projects/{project}/config to allow Email/Password
console.log('2) Enabling Email/Password sign-in via Identity Toolkit Admin API ...');
const patchUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=signIn.email`;
const patchBody = {
  signIn: {
    email: { enabled: true, passwordRequired: true },
  },
};
const r = await fetch(patchUrl, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify(patchBody),
});
const t = await r.text();
if (!r.ok) {
  console.error('Patch failed:', r.status, t);
  process.exit(4);
}
console.log('   → OK', t.length, 'bytes');
console.log('Done. Email/Password should now be enabled.');
