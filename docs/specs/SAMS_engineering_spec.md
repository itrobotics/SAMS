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
/class-pricing
/instructors
/instructor-schedule
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

學員分兩種類型：`child`（小朋友）與 `adult`（成人）。
兩者共用出席、班級、課程方案功能；僅基本資料欄位不同。
舊資料無 `profileType` 時，讀取端視為 `child`。

```ts
{
  studentId: string,
  branchId: string,
  name: string,
  gender: 'male' | 'female' | 'other',
  birthday: string,                       // YYYY-MM-DD（共用，向下相容）

  profileType: 'child' | 'adult',         // 預設 'child'

  // 小朋友專屬
  childProfile?: {
    grade: string,                         // '小一'..'高三'
    school: string,
    parent1Name: string,
    parent1Phone: string,
    parent1Email?: string,
    parent2Name?: string,
    parent2Phone?: string
  },

  // 成人專屬
  adultProfile?: {
    birthDate?: string,                    // YYYY-MM-DD
    education?: string,                    // '高中/職' | '專科' | '大學' | '碩士' | '博士'
    graduateSchool?: string,
    major?: string,
    company?: string,
    jobTitle?: string,
    idNumber?: string                      // 身分證字號（職訓用）
  },

  // 向下相容欄位（child 類型仍會同步寫入頂層）
  grade: string,
  parentName: string,
  parentPhone: string,

  // 通訊 / 戶籍地址、緊急聯絡人、備註
  mailingCity: string,
  mailingDistrict: string,
  mailingAddress: string,
  registeredAddressSameAsMailing: boolean,
  registeredCity: string,
  registeredDistrict: string,
  registeredAddress: string,
  emergencyContactName: string,
  emergencyContactRelation: string,
  notes: string,

  active: boolean,
  createdAt: timestamp
}
```

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

## class_pricing

```ts
{
  pricingId: string,                                       // 自動產生 PRnnnnnn（6 位）
  classId: string,
  branchId: string,
  className: string,                                        // denormalized
  price: number,                                            // TWD，每人費用
  priceType: 'per_class' | 'per_month' | 'per_session',
  notes: string,
  active: boolean,
  createdAt: timestamp,
  createdBy: string                                         // user.userId
}
```

> 同一 classId 可有多筆（例如優惠價、舊價）；以 `active` 控制是否納入營收估算。
> 預估營收 = `price × 該班 class_students.active 人數`，由 client 計算，不寫回 Firestore。

Firestore rules 在 MVP 階段沿用「登入即可讀寫」；分校隔離由 client 端 `where('branchId', 'in', user.branchIds)` 控制。

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

