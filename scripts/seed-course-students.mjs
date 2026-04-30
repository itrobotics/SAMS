// 一次性 seed 腳本：建立 30 個虛擬學生並加入課程方案 CRS00001
// 使用 Firestore REST API（用 admin 帳號的 idToken 授權）

const API_KEY   = 'AIzaSyDhkUU_bai8EkNZ-40jSiNChYKkQESyROg';
const PROJECT   = 'ithink-sams';
const COURSE_ID = 'CRS00001';
const EMAIL     = 'admin@ithink-sams.com';
const PASSWORD  = 'Sams2026!';

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// ── 虛擬學生資料（30 人）─────────────────────────────────
const SURNAMES = ['陳','林','黃','張','李','王','吳','劉','蔡','楊',
                  '許','鄭','謝','洪','邱','曾','廖','賴','徐','周',
                  '葉','蘇','莊','江','呂','何','羅','高','蕭','潘'];
const MALE_GIVEN   = ['宇軒','俊傑','冠宇','彥廷','建宏','志豪','奕翔','柏翰','承恩','聖傑'];
const FEMALE_GIVEN = ['雅婷','佳穎','欣怡','詩涵','宜蓁','庭妤','依霖','奕汝','芷涵','語彤'];

function pad(n) { return String(n).padStart(3, '0'); }

// ── Firestore value 轉換 helpers ─────────────────────────
function strV(s) { return { stringValue: s }; }
function boolV(b) { return { booleanValue: b }; }
function intV(n) { return { integerValue: String(n) }; }
function mapV(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = v;
  return { mapValue: { fields } };
}

async function api(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    const msg = json?.error?.message ?? text ?? `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return json;
}

// ── Auth ─────────────────────────────────────────────────
async function signIn() {
  const data = await api(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }) },
  );
  return data.idToken;
}

// ── Firestore REST helpers ────────────────────────────────
function fsHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function getDoc(token, path) {
  return api(`${BASE}/${path}`, { headers: fsHeaders(token) });
}

async function upsertDoc(token, collection, docId, fields) {
  const url = `${BASE}/${collection}/${docId}`;
  return api(url, {
    method: 'PATCH',
    headers: fsHeaders(token),
    body: JSON.stringify({ fields }),
  });
}

// ── 讀取 course 確認 branchId ─────────────────────────────
async function fetchBranchId(token) {
  const doc = await getDoc(token, `courses/${COURSE_ID}`);
  const branchId = doc.fields?.branchId?.stringValue;
  if (!branchId) throw new Error(`courses/${COURSE_ID} 找不到 branchId 欄位`);
  return branchId;
}

// ── 主流程 ────────────────────────────────────────────────
async function main() {
  console.log('🔐 登入中...');
  const token = await signIn();

  console.log(`📚 讀取 ${COURSE_ID}...`);
  const branchId = await fetchBranchId(token);
  console.log(`   branchId = ${branchId}`);

  const now = new Date().toISOString().slice(0, 10);
  let created = 0, enrolled = 0, skipped = 0;

  for (let i = 31; i <= 40; i++) {
    const surname  = SURNAMES[(i - 1) % SURNAMES.length];
    const isFemale = i % 3 === 0;
    const givenArr = isFemale ? FEMALE_GIVEN : MALE_GIVEN;
    const given    = givenArr[(i - 1) % givenArr.length];
    const name     = surname + given;
    const studentId = `STU${pad(i)}`;
    const gender   = isFemale ? 'female' : 'male';

    // ── 寫入 students/{studentId} ──────────────────────────
    const studentFields = {
      studentId:    strV(studentId),
      branchId:     strV(branchId),
      name:         strV(name),
      gender:       strV(gender),
      birthday:     strV(`200${(i % 6) + 1}-${String((i % 12) + 1).padStart(2,'0')}-${String((i % 28) + 1).padStart(2,'0')}`),
      grade:        strV(''),
      parentName:   strV(''),
      parentPhone:  strV(''),
      mailingCity:  strV('台北市'),
      mailingDistrict: strV('中正區'),
      mailingAddress: strV(`虛構路 ${i} 號`),
      registeredAddressSameAsMailing: boolV(true),
      registeredCity: strV(''),
      registeredDistrict: strV(''),
      registeredAddress: strV(''),
      emergencyContactName: strV(''),
      emergencyContactRelation: strV(''),
      notes: strV('seed 資料'),
      active: boolV(true),
    };

    try {
      await upsertDoc(token, 'students', studentId, studentFields);
      created++;
      process.stdout.write(`\r   學生 ${studentId} ${name} ✓ (${created}/10)`);
    } catch (e) {
      if (e.status === 409) { skipped++; }
      else { console.error(`\n   ✗ 學生 ${studentId} 失敗: ${e.message}`); }
    }

    // ── 寫入 course_enrollments/{COURSE_ID}__{studentId} ──
    const enrollId = `${COURSE_ID}__${studentId}`;
    const enrollFields = {
      enrollmentId: strV(enrollId),
      courseId:     strV(COURSE_ID),
      branchId:     strV(branchId),
      studentId:    strV(studentId),
      studentName:  strV(name),
      status:       strV('active'),
    };

    try {
      await upsertDoc(token, 'course_enrollments', enrollId, enrollFields);
      enrolled++;
    } catch (e) {
      console.error(`\n   ✗ 報名 ${enrollId} 失敗: ${e.message}`);
    }
  }

  console.log(`\n\n✅ 完成！`);
  console.log(`   學生建立/更新: ${created}，跳過: ${skipped} (STU031–STU040)`);
  console.log(`   課程報名建立/更新: ${enrolled}`);
  console.log(`   課程: ${COURSE_ID}，分校: ${branchId}`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
