# 學生到校管理系統 v2.0 Engineering Spec
## ICE SAMS (ICE Student Arrival Management System)

---

## 0. 文件目的

本文件提供工程團隊、AI 開發代理人、UI 設計師與 PM 使用，可直接作為開發依據。

系統定位：補習班版門診報到系統，支援多分校、人臉辨識、自助報到、總部即時管理。

---

## 1. System Architecture

```text
React Frontend (Admin / Dashboard / Kiosk)
        ↓
Firebase Auth
        ↓
Firestore Database
Firebase Storage
        ↓
Python Face Recognition API
```

---

## 2. Frontend Sitemap

```text
/login
/hq-dashboard
/branch-dashboard/:branchId
/session/:sessionId
/kiosk/:branchId
/students
/classes
/reports
/settings
```

---

## 3. Firestore Schema

## branches

```ts
{
  branchId: string,
  name: string,
  address: string,
  status: 'active' | 'disabled',
  createdAt: timestamp
}
```

## users

```ts
{
  userId: string,
  name: string,
  email: string,
  role: 'hq_admin' | 'branch_admin' | 'teacher' | 'staff',
  branchIds: string[],
  active: boolean
}
```

## students

```ts
{
  studentId: string,
  branchId: string,
  name: string,
  profileType: 'child' | 'adult',           // 預設 child（向下相容）
  gender?: 'male' | 'female' | 'other',
  birthday?: string,                         // YYYY-MM-DD
  phone?: string,
  city?: string,
  district?: string,
  address?: string,
  permanentAddress?: string,                 // 戶籍地址 (可填「同上」)
  emergencyContactName?: string,
  emergencyContactPhone?: string,
  emergencyContactRelation?: '父' | '母' | '兄弟姐妹' | '其他',
  notes?: string,
  active: boolean,
  createdAt: timestamp,

  // legacy fields (deprecated, fallback only)
  grade?: string,
  parentName?: string,
  parentPhone?: string,

  // child only
  childProfile?: {
    grade: string,
    school?: string,
    parent1?: { name: string, phone: string, relation: string, lineId?: string },
    parent2?: { name: string, phone: string, relation: string, lineId?: string },
  },

  // adult only
  adultProfile?: {
    education?: string,
    graduateSchool?: string,
    major?: string,
    company?: string,
    jobTitle?: string,
    idNumber?: string,                       // PII：寫入前考慮加密 / 限角色讀取
  }
}
```

**向下相容規則：**

- 若文件無 `profileType`，視為 `child`。
- UI 讀取年級 / 家長資訊時優先讀 `childProfile.*`；缺失才 fallback 至最上層 legacy 欄位。
- Migration 採 lazy 模式：學員下次被編輯儲存時補上 `profileType` 與對應 profile 物件，不做大批 backfill。

## classes

```ts
{
  classId: string,
  branchId: string,
  name: string,
  teacherId: string,
  classroom: string,
  weekday: number,
  startTime: string,
  endTime: string,
  active: boolean
}
```

## sessions

```ts
{
  sessionId: string,
  branchId: string,
  classId: string,
  className: string,
  date: string,
  startTime: string,
  endTime: string,
  status: 'waiting' | 'running' | 'finished'
}
```

## attendance_records

```ts
{
  recordId: string,
  sessionId: string,
  studentId: string,
  studentName: string,
  status: 'CHECKED_IN' | 'LATE' | 'LEAVE' | 'ABSENT',
  method: 'FACE' | 'MANUAL',
  confidence: number,
  checkinTime: timestamp,
  operatorId?: string
}
```

## face_profiles

```ts
{
  profileId: string,
  studentId: string,
  branchId: string,
  photoPath: string,
  embedding: number[],
  qualityScore: number,
  active: boolean,
  createdAt: timestamp
}
```

## leave_requests

```ts
{
  leaveId: string,
  studentId: string,
  studentName: string,
  branchId: string,
  sessionId: string,
  classId: string,
  className: string,
  sessionDate: string,                        // YYYY-MM-DD
  reason: string,
  status: 'pending' | 'approved' | 'rejected' | 'cancelled',
  createdBy: string,
  createdAt: timestamp,
  approvedBy: string | null,
  approvedAt: timestamp | null,
  rejectedReason: string | null,
}
```

approve 時將對應 `attendance_records.status` 由 `SCHEDULED` 改為 `LEAVE`，並寫回連結 `attendance_records.leaveId`。

## class_pricing

```ts
{
  pricingId: string,
  classId: string,
  branchId: string,
  price: number,
  priceType: 'per_month' | 'per_session' | 'per_class',
  currency: 'TWD',
  effectiveFrom: string,                      // YYYY-MM-DD
  effectiveTo: string | null,                 // null = 仍有效
  notes?: string,
  createdBy: string,
  createdAt: timestamp,
  updatedAt: timestamp,
}
```

同 classId 在同一時間區間僅能有一筆有效定價。

## courses

```ts
{
  courseId: string,
  branchId: string,
  name: string,
  courseType: string,                          // 來源：app_options.courseTypes
  summary?: string,
  startDate: string,                           // YYYY-MM-DD
  endDate: string,
  totalHours: number,
  totalSessions: number,
  capacity: number,
  tuition: number,
  tuitionType: 'per_program' | 'per_module',
  instructorIds: string[],
  classroom?: string,
  status: 'draft' | 'enrolling' | 'running' | 'finished' | 'cancelled',
  createdAt: timestamp,
}
```

## course_modules

```ts
{
  moduleId: string,
  courseId: string,
  name: string,
  orderIndex: number,
  totalSessions: number,
  totalHours: number,
  moduleTuition?: number,
}
```

## course_sessions

```ts
{
  courseSessionId: string,
  courseId: string,
  moduleId?: string,
  branchId: string,
  date: string,                                 // YYYY-MM-DD
  startTime: string,
  endTime: string,
  instructorId: string,
  classroom?: string,
  topic?: string,
  status: 'waiting' | 'running' | 'finished',
}
```

## course_enrollments

```ts
{
  enrollmentId: string,
  courseId: string,
  studentId: string,
  branchId: string,
  enrolledAt: timestamp,
  tuitionPaid: number,
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'refunded',
  status: 'active' | 'withdrawn' | 'completed',
  moduleIds?: string[],                         // 部分模組報名時用
  notes?: string,
}
```

## course_attendance

```ts
{
  recordId: string,
  courseSessionId: string,
  courseId: string,
  studentId: string,
  studentName: string,
  status: 'SCHEDULED' | 'CHECKED_IN' | 'LATE' | 'LEAVE' | 'ABSENT',
  method: null | 'FACE' | 'MANUAL',
  confidence: null | number,
  checkinTime: null | timestamp,
  operatorId?: string,
}
```

## app_options

```ts
{
  optionId: string,
  category: 'relationships' | 'courseTypes' | string,
  value: string,
  orderIndex: number,
  active: boolean,
}
```

---

## 4. Firebase Storage Structure

```text
/branches/anhe/students/S001/photo1.jpg
/branches/anhe/students/S001/photo2.jpg
/branches/dazhi/students/S888/photo1.jpg
```

---

## 5. API Specification

## Face Recognition API

### POST /api/face/register

用途：新增學生照片並產生 embedding。

Request:

```json
{
  "studentId": "S001",
  "branchId": "anhe",
  "imageBase64": "..."
}
```

Response:

```json
{
  "success": true,
  "profileId": "FP001",
  "qualityScore": 0.91
}
```

---

### POST /api/face/checkin

用途：人臉辨識報到。

Request:

```json
{
  "branchId": "anhe",
  "sessionId": "20260427_C001",
  "imageBase64": "..."
}
```

Response:

```json
{
  "success": true,
  "matchedStudentId": "S001",
  "name": "王小明",
  "confidence": 0.89,
  "status": "CHECKED_IN"
}
```

---

### POST /api/checkin/manual

用途：老師手動報到。

---

## 6. Face Recognition Module Spec

### Engine

```text
Python + face_recognition
```

### Flow

```text
Webcam 擷取影像
→ Detect Face
→ Generate Embedding
→ Compare Branch + Today Session Students
→ Return Best Match
```

### Confidence Rule

- >= 0.85：自動報到
- 0.70 ~ 0.84：人工確認
- < 0.70：失敗

---

## 7. UI Wireframes

## HQ Dashboard

顯示所有分校：

| 分校 | 應到 | 已到 | 未到 | 請假 | 到班率 |
|---|---:|---:|---:|---:|---:|

## Branch Dashboard

| 班級 | 應到 | 已到 | 未到 | 狀態 |
|---|---:|---:|---:|---|

## Session Page

| 學生 | 狀態 | 時間 | 方式 |
|---|---|---|---|

## Kiosk Screen

```text
請站到鏡頭前
Ready to Check-in
```

成功：

```text
早安，王小明！
報到成功
08:05:21
```

---

## 8. Security Rules

## Firestore

- HQ 可讀全部
- 分校僅讀自身 branchId
- 老師僅讀 assigned classes
- Kiosk 僅寫入 attendance_records

## Storage

- 照片需登入授權
- 僅管理角色可讀取原圖

---

## 9. Performance Target

- 人臉辨識回應 < 2 秒
- Dashboard 更新 < 1 秒
- 同時在線 10 間分校可運作

---

## 10. Sprint Plan

## Sprint 1

- Auth
- Branches
- Students
- Classes

## Sprint 2

- Sessions
- Attendance UI
n- Manual Check-in

## Sprint 3

- Face Register API
- Face Check-in API
- Kiosk UI

## Sprint 4

- HQ Dashboard
- Reports
- Notifications

---

## 11. AI Agent Task List

```text
Task-001 建立 Firestore collections
Task-002 React Login Page
Task-003 Branch Dashboard 即時同步
Task-004 Session Attendance Page
Task-005 Python Face Register API
Task-006 Python Face Check-in API
Task-007 Kiosk Webcam UI
Task-008 HQ Dashboard KPI
```

---

## 12. Launch MVP Goal

第一階段上線目標：

- 三間分校可使用
- 每日課程自動產生
- 學生可人臉報到
- 老師可手動報到
- HQ 可查看各分校狀態

---

## 13. Product Statement

> ICE SAMS 是一套多分校補習班到校管理平台，以人臉辨識為特色入口，讓總部與分校即時掌握學生到校狀態，建立可複製的營運管理制度。

---

## 14. Multi-tenant Deployment（Silo 模型）

SAMS 採用 **Silo 多租戶模型**：每個客戶（補習班）擁有獨立的 Firebase 專案，資料完全隔離。同一份程式碼透過不同的 `.env` 檔切換目標 Firebase 專案，不需要修改原始碼。

### 14.1 設計原則

- 每個客戶 = 一個獨立 Firebase 專案（獨立 Firestore / Auth / Storage / Hosting）
- 程式碼共用，環境設定隔離
- 真實 API key 不進 git；`.env` 由 `.gitignore` 排除，`.env.example` 為範本

### 14.2 環境變數

`src/services/firebase.ts` 讀取 `import.meta.env`，由 Vite 在 build 時注入：

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

### 14.3 新客戶部署流程

1. 為該客戶在 Firebase Console 建立全新專案，啟用 Firestore / Auth / Storage / Hosting
2. 取得該專案的 Web App config
3. 在本地 clone 程式碼後：
   - 複製 `.env.example` 為 `.env`
   - 填入該客戶的 Firebase config
4. 部署：

   ```bash
   firebase deploy --only firestore:rules --project <projectId>
   firebase deploy --only storage         --project <projectId>
   npm run build
   firebase deploy --only hosting         --project <projectId>
   ```

   或一次跑完整套部署（rules + build + hosting，依本專案慣例）。
5. 部署完成後，於該客戶 Firebase Console 建立首位 HQ_ADMIN 帳號，後續分校 / 班級 / 學生資料由客戶自行建立。

### 14.4 注意事項

- `.env` 永遠不可 commit；切換客戶時請重新複製
- 不同客戶的 Firestore rules / Storage rules / indexes 同樣以該客戶專案為部署目標
- 程式碼層面不需要區分客戶；客戶間的差異只能透過資料（settings collection 等）表達，不可寫死在 code 裡
- 切勿在 codebase 引入 `if (customerId === ...)` 之類的客戶判斷式

### 14.5 Firebase CLI 專案別名

`.firebaserc` 可在同一個 working copy 維護多個別名，方便切換：

```json
{
  "projects": {
    "default": "ithink-sams",
    "ice": "ithink-sams",
    "demo": "sams-demo-xxxxx"
  }
}
```

部署時：

```bash
firebase deploy --only hosting --project ice
firebase deploy --only hosting --project demo
```

**重點：** `.firebaserc` 的別名只決定「部署到哪個 Firebase 專案」，client-side 連線目標仍由 `.env` 的 `VITE_FIREBASE_*` 決定。兩者必須對齊（同一客戶的 .firebaserc + .env），否則會出現「程式碼指向 A、實際資料在 B」的偏差。

### 14.6 首次部署檢查表

新客戶上線前確認：

- [ ] Firebase 專案已啟用 Firestore（Native mode）
- [ ] Firebase 專案已啟用 Authentication（Email/Password provider）
- [ ] 若會用到人臉照片：Firebase Storage 已點 Get Started
- [ ] Firebase 專案已啟用 Hosting
- [ ] `.env` 已填入該客戶的 7 個 `VITE_FIREBASE_*` 變數
- [ ] `.firebaserc` 已加入該客戶 alias
- [ ] `firestore.rules` 已 deploy（`--only firestore:rules`）
- [ ] `storage.rules` 已 deploy（若 Storage 已啟用）
- [ ] `firestore.indexes.json` 已 deploy
- [ ] `npm run build` 成功，bundle 含正確的 projectId
- [ ] `firebase deploy --only hosting` 成功
- [ ] Hosting URL 可開啟並進入登入頁
- [ ] 已透過 seed script 建立首位 HQ_ADMIN 帳號
- [ ] HQ_ADMIN 可登入並建立第一個分校 / 班級 / 學生

