// 學員批次匯入服務
//
// 解析 CSV / Excel → 偵測重複 → 批次寫入 Firestore
// Firestore batch 上限 500 ops；每筆學員最多 2 ops（student + enrollment），故每批 200 筆。

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

import { db } from './firebase';
import { STUDENTS_COLLECTION } from '../types/student';
import { CLASS_STUDENTS_COLLECTION, classStudentDocId } from '../types/classStudent';

// ─── 公開型別 ────────────────────────────────────────────────────────────────

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

export type FieldMapping = Record<string, string>; // systemField → fileColumn | ''

export interface DuplicateInfo {
  rowIndex: number;
  name: string;
  matchField: 'phone' | 'idNumber';
  matchValue: string;
  existingStudentId: string;
}

export interface ImportResult {
  total: number;
  success: number;
  skipped: number;
  updated: number;
  failed: number;
  errors: { row: number; name: string; reason: string }[];
}

// ─── 系統欄位清單 ─────────────────────────────────────────────────────────────

export const SYSTEM_FIELDS: {
  key: string;
  label: string;
  desc: string;
  required?: boolean;
}[] = [
  { key: 'name',          label: '姓名',         desc: 'name',              required: true },
  { key: 'phone',         label: '電話',         desc: 'phone' },
  { key: 'email',         label: 'Email',        desc: 'email' },
  { key: 'idNumber',      label: '身分證號',      desc: 'idNumber' },
  { key: 'profileType',   label: '學員類型',      desc: 'child / adult（預設 adult）' },
  { key: 'birthDate',     label: '生日',         desc: 'YYYY-MM-DD' },
  { key: 'education',     label: '學歷',         desc: 'education' },
  { key: 'graduateSchool',label: '畢業學校',      desc: 'graduateSchool' },
  { key: 'major',         label: '科系',         desc: 'major' },
  { key: 'company',       label: '任職公司',      desc: 'company' },
  { key: 'jobTitle',      label: '職稱',         desc: 'jobTitle' },
  { key: 'mobilePhone',   label: '手機',         desc: 'mobilePhone' },
  { key: 'homePhone',     label: '家裡電話',      desc: 'homePhone' },
  { key: 'grade',         label: '年級',         desc: '(child)' },
  { key: 'school',        label: '就讀學校',      desc: '(child)' },
  { key: 'parent1Name',   label: '家長1姓名',     desc: 'parent1Name' },
  { key: 'parent1Phone',  label: '家長1電話',     desc: 'parent1Phone' },
];

// 欄位名稱別名（用於自動對應）
const FIELD_ALIASES: Record<string, string[]> = {
  name:          ['姓名', 'name', '學員姓名', '名字', '學員'],
  phone:         ['電話', 'phone', '聯絡電話', '電話號碼', '聯絡電話號碼'],
  email:         ['email', 'Email', '電子郵件', 'E-mail', 'e-mail', '電郵'],
  idNumber:      ['身分證號', '身份證號', '身分證', 'idNumber', '身分證號碼', '身份證字號'],
  profileType:   ['學員類型', '類型', 'profileType', '成人兒童', '成人/兒童'],
  birthDate:     ['生日', '出生日期', 'birthDate', 'birthday', '出生年月日'],
  education:     ['學歷', '最高學歷', 'education', '學歷背景'],
  graduateSchool:['畢業學校', 'graduateSchool', '畢業院校'],
  major:         ['科系', 'major', '主修', '科系名稱', '專業'],
  company:       ['任職公司', '公司', 'company', '公司名稱', '服務單位'],
  jobTitle:      ['職稱', 'jobTitle', '職位', '職務'],
  mobilePhone:   ['手機', 'mobilePhone', '行動電話', '手機號碼'],
  homePhone:     ['家裡電話', 'homePhone', '家用電話', '市話', '市內電話'],
  grade:         ['年級', 'grade', '就讀年級'],
  school:        ['就讀學校', 'school', '學校名稱', '目前學校'],
  parent1Name:   ['家長1姓名', '家長姓名', '家長', 'parent1Name', '監護人'],
  parent1Phone:  ['家長1電話', '家長電話', 'parent1Phone', '家長聯絡電話', '監護人電話'],
};

// ─── parseFile ───────────────────────────────────────────────────────────────

export async function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return parseCsv(file);
  if (ext === 'xlsx' || ext === 'xls') return parseExcel(file);
  throw new Error('不支援的檔案格式，請上傳 .csv 或 .xlsx 檔案');
}

function parseCsv(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        resolve({ headers: result.meta.fields ?? [], rows: result.data });
      },
      error: (err: { message: string }) => reject(new Error(err.message)),
    });
  });
}

async function parseExcel(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };
  const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
  if (data.length === 0) return { headers: [], rows: [] };
  // Ensure all values are strings
  const rows = data.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])),
  );
  return { headers: Object.keys(rows[0]), rows };
}

// ─── autoMatchFields ──────────────────────────────────────────────────────────

export function autoMatchFields(fileHeaders: string[]): FieldMapping {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]/g, '');
  const mapping: FieldMapping = {};
  for (const field of SYSTEM_FIELDS) {
    const aliases = (FIELD_ALIASES[field.key] ?? []).map(norm);
    const match = fileHeaders.find((h) => aliases.includes(norm(h)));
    mapping[field.key] = match ?? '';
  }
  return mapping;
}

// ─── detectDuplicates ────────────────────────────────────────────────────────

export async function detectDuplicates(
  rows: Record<string, string>[],
  fieldMapping: FieldMapping,
): Promise<DuplicateInfo[]> {
  const snap = await getDocs(collection(db, STUDENTS_COLLECTION));
  const phoneIdx = new Map<string, string>();
  const idNumIdx = new Map<string, string>();
  snap.docs.forEach((d) => {
    const data = d.data() as Record<string, string>;
    if (data.phone?.trim()) phoneIdx.set(data.phone.trim(), d.id);
    if (data.idNumber?.trim()) idNumIdx.set(data.idNumber.trim(), d.id);
  });

  const dupes: DuplicateInfo[] = [];
  rows.forEach((row, idx) => {
    const get = (f: string) => { const c = fieldMapping[f]; return c ? (row[c] ?? '').trim() : ''; };
    const name   = get('name');
    const phone  = get('phone');
    const idNum  = get('idNumber');
    if (phone && phoneIdx.has(phone)) {
      dupes.push({ rowIndex: idx, name, matchField: 'phone', matchValue: phone, existingStudentId: phoneIdx.get(phone)! });
      return;
    }
    if (idNum && idNumIdx.has(idNum)) {
      dupes.push({ rowIndex: idx, name, matchField: 'idNumber', matchValue: idNum, existingStudentId: idNumIdx.get(idNum)! });
    }
  });
  return dupes;
}

// ─── importStudents ──────────────────────────────────────────────────────────

export async function importStudents(
  classId: string,
  branchId: string,
  rows: Record<string, string>[],
  fieldMapping: FieldMapping,
  duplicateAction: 'skip' | 'update',
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { total: rows.length, success: 0, skipped: 0, updated: 0, failed: 0, errors: [] };

  // 一次性載入現有學員（用於重複偵測 + 取得目前最大 ID 編號）
  const snap = await getDocs(collection(db, STUDENTS_COLLECTION));
  const phoneIdx = new Map<string, string>();
  const idNumIdx = new Map<string, string>();
  let maxNum = 0;

  snap.docs.forEach((d) => {
    const data = d.data() as Record<string, string>;
    if (data.phone?.trim()) phoneIdx.set(data.phone.trim(), d.id);
    if (data.idNumber?.trim()) idNumIdx.set(data.idNumber.trim(), d.id);
    const m = d.id.match(/^S(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });

  let nextNum = maxNum + 1;
  const CHUNK = 200; // 200 rows × max 2 ops = 400 ops < 500 Firestore batch limit

  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = writeBatch(db);
    const chunk = rows.slice(i, i + CHUNK);

    for (let j = 0; j < chunk.length; j++) {
      const rowIndex = i + j;
      const row = chunk[j];
      const get = (f: string) => { const c = fieldMapping[f]; return c ? (row[c] ?? '').trim() : ''; };

      const name = get('name');
      if (!name) {
        result.failed++;
        result.errors.push({ row: rowIndex + 1, name: '(空)', reason: '姓名為必填欄位' });
        continue;
      }

      const phone = get('phone');
      const idNum = get('idNumber');
      let existingId: string | undefined;
      if (phone && phoneIdx.has(phone)) existingId = phoneIdx.get(phone);
      if (!existingId && idNum && idNumIdx.has(idNum)) existingId = idNumIdx.get(idNum);

      if (existingId) {
        const csRef = doc(db, CLASS_STUDENTS_COLLECTION, classStudentDocId(classId, existingId));
        if (duplicateAction === 'skip') {
          result.skipped++;
          batch.set(csRef, { classId, studentId: existingId, branchId, active: true, joinedAt: serverTimestamp() }, { merge: true });
        } else {
          const upd = buildUpdateData(row, fieldMapping);
          if (Object.keys(upd).length > 0) {
            batch.update(doc(db, STUDENTS_COLLECTION, existingId), upd);
          }
          batch.set(csRef, { classId, studentId: existingId, branchId, active: true, joinedAt: serverTimestamp() }, { merge: true });
          result.updated++;
        }
      } else {
        const studentId = `S${String(nextNum).padStart(3, '0')}`;
        nextNum++;
        if (phone) phoneIdx.set(phone, studentId);
        if (idNum)  idNumIdx.set(idNum, studentId);

        batch.set(
          doc(db, STUDENTS_COLLECTION, studentId),
          buildCreateData(row, fieldMapping, branchId),
        );
        batch.set(
          doc(db, CLASS_STUDENTS_COLLECTION, classStudentDocId(classId, studentId)),
          { classId, studentId, branchId, active: true, joinedAt: serverTimestamp() },
          { merge: true },
        );
        result.success++;
      }
    }

    await batch.commit();
    onProgress?.(Math.min(i + CHUNK, rows.length), rows.length);
  }

  return result;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function getUnmappedNotes(row: Record<string, string>, fieldMapping: FieldMapping): string {
  const mappedCols = new Set(Object.values(fieldMapping).filter(Boolean));
  return Object.entries(row)
    .filter(([k, v]) => !mappedCols.has(k) && v?.trim())
    .map(([k, v]) => `${k}: ${v.trim()}`)
    .join('\n');
}

function buildCreateData(
  row: Record<string, string>,
  fieldMapping: FieldMapping,
  branchId: string,
): Record<string, unknown> {
  const get = (f: string) => { const c = fieldMapping[f]; return c ? (row[c] ?? '').trim() : ''; };
  const pt = get('profileType');
  return {
    branchId,
    name: get('name'),
    gender: 'other',
    birthday: get('birthDate'),
    grade: get('grade'),
    parentName: get('parent1Name'),
    parentPhone: get('parent1Phone'),
    mailingCity: '',
    mailingDistrict: '',
    mailingAddress: '',
    registeredAddressSameAsMailing: false,
    registeredCity: '',
    registeredDistrict: '',
    registeredAddress: '',
    emergencyContactName: '',
    emergencyContactRelation: '',
    phone: get('phone'),
    email: get('email'),
    idNumber: get('idNumber'),
    profileType: (pt === 'child' || pt === 'adult') ? pt : 'adult',
    education: get('education'),
    graduateSchool: get('graduateSchool'),
    major: get('major'),
    company: get('company'),
    jobTitle: get('jobTitle'),
    mobilePhone: get('mobilePhone'),
    homePhone: get('homePhone'),
    school: get('school'),
    notes: getUnmappedNotes(row, fieldMapping),
    active: true,
    createdAt: serverTimestamp(),
  };
}

// buildUpdateData 只包含「有對應且非空值」的欄位，保留現有資料
function buildUpdateData(
  row: Record<string, string>,
  fieldMapping: FieldMapping,
): Record<string, unknown> {
  const upd: Record<string, unknown> = {};
  const fieldToDocKey: Record<string, string> = {
    name: 'name', phone: 'phone', email: 'email', idNumber: 'idNumber',
    profileType: 'profileType', birthDate: 'birthday',
    education: 'education', graduateSchool: 'graduateSchool', major: 'major',
    company: 'company', jobTitle: 'jobTitle',
    mobilePhone: 'mobilePhone', homePhone: 'homePhone',
    grade: 'grade', school: 'school',
    parent1Name: 'parentName', parent1Phone: 'parentPhone',
  };
  for (const [sysField, docKey] of Object.entries(fieldToDocKey)) {
    const col = fieldMapping[sysField];
    if (col) {
      const val = (row[col] ?? '').trim();
      if (val) upd[docKey] = val;
    }
  }
  const notes = getUnmappedNotes(row, fieldMapping);
  if (notes) upd.notes = notes;
  return upd;
}
