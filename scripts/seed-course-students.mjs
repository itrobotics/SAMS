// 一次性 seed 腳本：建立虛擬學生並加入課程方案
// 使用 Firestore REST API（用 admin 帳號的 idToken 授權）

const API_KEY   = 'AIzaSyDhkUU_bai8EkNZ-40jSiNChYKkQESyROg';
const PROJECT   = 'ithink-sams';
const COURSE_ID = 'CRS00001';
const EMAIL     = 'admin@ithink-sams.com';
const PASSWORD  = 'Sams2026!';

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const SURNAMES = ['陳','林','黃','張','李','王','吳','劉','蔡','楊',
                  '許','鄭','謝','洪','邱','曾','廖','賴','徐','周',
                  '葉','蘇','莊','江','呂','何','羅','高','蕭','潘'];
const MALE_GIVEN   = ['宇軒','俊傑','冠宇','彥廷','建宏','志豪','奕翔','柏翰','承恩','聖傑'];
const FEMALE_GIVEN = ['雅婷','佳穎','欣怡','詩涵','宜蓁','庭妤','依霖','奕汝','芷涵','語彤'];

function pad(n) { return String(n).padStart(3, '0'); }
function strV(s) { return { stringValue: s }; }
function boolV(b) { return { booleanValue: b }; }

async function api(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? text), { status: res.status });
  return json;
}

async function signIn() {
  const data = await api(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }) },
  );
  return data.idToken;
}

function fsHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function upsertDoc(token, collection, docId, fields) {
  return api(`${BASE}/${collection}/${docId}`, {
    method: 'PATCH',
    headers: fsHeaders(token),
    body: JSON.stringify({ fields }),
  });
}

async function fetchBranchId(token) {
  const doc = await api(`${BASE}/courses/${COURSE_ID}`, { headers: fsHeaders(token) });
  const branchId = doc.fields?.branchId?.stringValue;
  if (!branchId) throw new Error(`courses/${COURSE_ID} 找不到 branchId`);
  return branchId;
}

async function main() {
  // 從 CLI 引數決定範圍，預設 1–40
  const start = parseInt(process.argv[2] ?? '1', 10);
  const end   = parseInt(process.argv[3] ?? '40', 10);
  const count = end - start + 1;

  console.log(`🔐 登入中...`);
  const token = await signIn();

  console.log(`📚 讀取 ${COURSE_ID}...`);
  const branchId = await fetchBranchId(token);
  console.log(`   branchId = ${branchId}`);
  console.log(`   建立學生 STU${pad(start)}–STU${pad(end)}（共 ${count} 筆）\n`);

  let created = 0, enrolled = 0;
  for (let i = start; i <= end; i++) {
    const surname  = SURNAMES[(i - 1) % SURNAMES.length];
    const isFemale = i % 3 === 0;
    const given    = (isFemale ? FEMALE_GIVEN : MALE_GIVEN)[(i - 1) % 10];
    const name     = surname + given;
    const studentId = `STU${pad(i)}`;

    await upsertDoc(token, 'students', studentId, {
      studentId: strV(studentId), branchId: strV(branchId), name: strV(name),
      gender: strV(isFemale ? 'female' : 'male'),
      birthday: strV(`200${(i % 6) + 1}-${String((i % 12) + 1).padStart(2,'0')}-${String((i % 28) + 1).padStart(2,'0')}`),
      grade: strV(''), parentName: strV(''), parentPhone: strV(''),
      mailingCity: strV('台北市'), mailingDistrict: strV('中正區'), mailingAddress: strV(`虛構路 ${i} 號`),
      registeredAddressSameAsMailing: boolV(true),
      registeredCity: strV(''), registeredDistrict: strV(''), registeredAddress: strV(''),
      emergencyContactName: strV(''), emergencyContactRelation: strV(''),
      notes: strV('seed 資料'), active: boolV(true),
    });
    created++;

    const enrollId = `${COURSE_ID}__${studentId}`;
    await upsertDoc(token, 'course_enrollments', enrollId, {
      enrollmentId: strV(enrollId), courseId: strV(COURSE_ID),
      branchId: strV(branchId), studentId: strV(studentId),
      studentName: strV(name), status: strV('active'),
    });
    enrolled++;
    process.stdout.write(`\r   ${studentId} ${name} ✓ (${created}/${count})`);
  }

  console.log(`\n\n✅ 完成！學生: ${created}，報名: ${enrolled}，課程: ${COURSE_ID}`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
