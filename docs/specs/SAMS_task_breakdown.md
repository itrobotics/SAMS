# 學生到校管理系統｜Task Breakdown + 開發順序
## ICE SAMS Development Plan v1.0

---

## 開發狀態總覽（最後更新：2026-05-01）

### ✅ 已完成（Tasks 001 – 066）

| Phase | 名稱 | 狀態 | 涵蓋 Task |
|---|---|---|---|
| Phase 0 | 專案初始化 | ✅ | 001 – 004 |
| Phase 1 | 登入與權限 | ✅ | 005 – 007 |
| Phase 2 | 多分校基礎資料 | ✅ | 008 – 010 |
| Phase 3 | 學生資料管理 | ✅ | 011 – 014 |
| Phase 4 | 班級與排課 | ✅ | 015 – 019 |
| Phase 5 | 每日場次產生 | ✅ | 020 – 023 |
| Phase 6 | 班級報到系統 MVP | ✅ | 024 – 028 |
| Phase 7 | Kiosk 自助報到畫面 | ✅ | 029 – 031 |
| Phase 8 | 人臉照片註冊模組 | ✅ | 032 – 035 |
| Phase 9 | 人臉報到模組 | ✅ | 036 – 041 |
| Phase 10 | HQ Dashboard | ✅ | 042 – 044 |
| Mid-dev | 進階功能擴充（見下方 §M1） | ✅ | 045 – 066 |

### 🚧 待開發

| Phase | 名稱 | 預計 Task |
|---|---|---|
| Phase 11 | 請假模組（細節重新規劃） | 067 – 071 |
| Phase 12 | 通知模組 | 072 – 074 |
| Phase 13 | 報表分析 | 075 – 077 |
| Phase 14 | 系統設定（剩餘） | 078 – 079 |
| Phase 15 | 測試與上線 | 080 – 083 |
| Phase 16 | 班級定價模組（新） | 084 – 088 |
| Phase 17 | 課程方案模組（新） | 089 – 098 |
| Phase 18 | 學員 Profile 類型 child / adult（新） | 099 – 103 |

> 完整規格請參考 `SAMS_spec_v_1_0.md` 與 `SAMS_engineering_spec.md`。

---

## §M1 Mid-development 進階功能擴充（Tasks 045 – 066，已完成）

原始 spec 的 Phase 11–15 task 編號被重新分配給 2026-04 之後追加的需求（講師管理、選項管理、台灣地址、各表單擴充欄位、定價設計、設定頁等）。實際完成內容：

| Task | 主題 |
|---|---|
| 045 | app_options collection、OptionsPage、選項管理 |
| 046 | 講師管理 CRUD（instructors） |
| 047 | 學員 / 班級 / 講師編號自動遞增 |
| 048 | 班級清單顯示班級學生人數 |
| 049 | 班級允許跨分校加入學生 |
| 050 | 講師：性別、縣市/地址拆分、鐘點費、累計教學時數、備註 |
| 051 | 學生：在編輯表單支援永久刪除（Alert 確認） |
| 052 | app_options 新增 `courseTypes`（micro:bit、Scratch、Python…） |
| 053 | 班級：講師欄位改 dropdown、新增 courseType dropdown |
| 054 | 台灣縣市 / 鄉鎮資料、`TaiwanAddressFields` 元件 |
| 055 | 班級清單講師顯示 `T001-Joseph` 格式 |
| 056 | 學生：性別、生日、完整地址、緊急聯絡人、備註 |
| 057 | 講師：生日、行政區、套用 TaiwanAddressFields |
| 058 | 班級：courseStartDate / courseEndDate / courseHours、create 模式可改 active |
| 059 | 班級時段格式 `週二 18:00–18:30（講師 T003 matt｜教室 101）` |
| 060 | 班級清單「上課講師」、列出全部講師、期間 filter、姓名搜尋 |
| 061 | 講師排課頁 `/instructors/:id/schedule`、period / status filter |
| 062 | 全系統 UI「老師」→「講師」 |
| 063 | 分校：servicePhone、director 系列、notes |
| 064 | 分校列表顯示 servicePhone、directorName |
| 065 | 分校 Dashboard 場次刪除（含 attendance_records 連動） |
| 066 | 設定頁：graceMinutes 編輯（依分校） |

---

## 0. 開發策略

本系統建議採用 **先做可運作 MVP，再逐步加上人臉辨識、通知、報表與管理分析** 的方式開發。

核心原則：

1. 先讓資料流跑通
2. 先讓老師可以手動報到
3. 再加入人臉辨識
4. 最後做總部 Dashboard 與報表分析

原因：

- 人臉辨識是特色，但不是第一個要做的基礎
- 報到狀態、班級場次、分校資料必須先建立
- 沒有完整的學生 / 班級 / 場次資料，人臉辨識也無法正確報到

---

# Phase 0｜專案初始化 ✅

## 目標

建立 React + Firebase 專案基礎架構。

## Tasks

### Task 001｜建立 React 專案

- 使用 Vite 建立 React 專案
- 設定 TypeScript
- 設定基本資料夾結構

建議資料夾：

```text
/src
  /components
  /pages
  /routes
  /services
  /hooks
  /types
  /utils
```

---

### Task 002｜建立 Firebase 專案

- 建立 Firebase Project
- 啟用 Firestore
- 啟用 Firebase Storage
- 啟用 Firebase Auth
- 建立 Firebase Web App
- 取得 Firebase config

---

### Task 003｜前端串接 Firebase

- 建立 `firebase.ts`
- 初始化 Firebase App
- 初始化 Firestore
- 初始化 Auth
- 初始化 Storage

---

### Task 004｜建立路由架構

頁面：

```text
/login
/hq-dashboard
/branch-dashboard/:branchId
/session/:sessionId
/kiosk/:branchId
/students
/classes
/settings
```

---

# Phase 1｜登入與權限 ✅

## 目標

建立基本登入流程與角色權限。

---

### Task 005｜建立 Login Page

功能：

- Email / Password 登入
- 登入成功後依角色導向不同首頁

角色導向：

```text
hq_admin → /hq-dashboard
branch_admin → /branch-dashboard/:branchId
teacher → /branch-dashboard/:branchId
staff → /branch-dashboard/:branchId
```

---

### Task 006｜建立 users collection

Firestore collection：`users`

欄位：

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

---

### Task 007｜建立 Auth Guard

功能：

- 未登入不可進入系統
- 無權限不可進入其他分校
- Kiosk 可獨立設定登入帳號

---

# Phase 2｜多分校基礎資料 ✅

## 目標

建立多分校管理基礎。

---

### Task 008｜建立 branches collection

欄位：

```ts
{
  branchId: string,
  name: string,
  address: string,
  status: 'active' | 'disabled',
  createdAt: timestamp
}
```

---

### Task 009｜建立分校清單頁

功能：

- HQ 可看所有分校
- 分校管理者只能看自己的分校
- 顯示分校狀態

---

### Task 010｜建立分校 CRUD

功能：

- 新增分校
- 編輯分校
- 停用分校

---

# Phase 3｜學生資料管理 ✅

## 目標

建立學生主檔。

---

### Task 011｜建立 students collection

欄位：

```ts
{
  studentId: string,
  branchId: string,
  name: string,
  grade: string,
  parentName: string,
  parentPhone: string,
  active: boolean,
  createdAt: timestamp
}
```

---

### Task 012｜建立學生列表頁

功能：

- 分校篩選
- 姓名搜尋
- 年級篩選
- 啟用 / 停用狀態

---

### Task 013｜建立學生新增 / 編輯表單

欄位：

- 姓名
- 年級
- 分校
- 家長姓名
- 家長電話
- 狀態

---

### Task 014｜建立學生詳細頁

顯示：

- 基本資料
- 所屬班級
- 人臉照片狀態
- 最近出席紀錄

---

# Phase 4｜班級與排課 ✅

## 目標

建立班級與學生對應關係。

---

### Task 015｜建立 classes collection

欄位：

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

---

### Task 016｜建立 class_students collection

用途：管理班級與學生關係。

```ts
{
  classId: string,
  studentId: string,
  branchId: string,
  active: boolean,
  joinedAt: timestamp
}
```

---

### Task 017｜建立班級列表頁

功能：

- 分校篩選
- 老師篩選
- 上課日篩選
- 啟用狀態

---

### Task 018｜建立班級新增 / 編輯頁

功能：

- 設定班級名稱
- 設定老師
- 設定教室
- 設定星期幾
- 設定上課時間
- 設定下課時間

---

### Task 019｜建立班級學生管理頁

功能：

- 加入學生
- 移除學生
- 顯示班級學生名單

---

# Phase 5｜每日場次產生 ✅

## 目標

把「固定班級」轉成「每日實際上課場次」。

---

### Task 020｜建立 sessions collection

欄位：

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

---

### Task 021｜建立 attendance_records collection

每個 session 產生時，同步建立應到學生紀錄。

```ts
{
  recordId: string,
  sessionId: string,
  branchId: string,
  classId: string,
  studentId: string,
  studentName: string,
  status: 'SCHEDULED' | 'CHECKED_IN' | 'LATE' | 'LEAVE' | 'ABSENT',
  method: null | 'FACE' | 'MANUAL',
  confidence: null | number,
  checkinTime: null | timestamp,
  operatorId: null | string
}
```

---

### Task 022｜建立產生今日場次功能

功能：

- 依據今天星期幾產生今日 sessions
- 依據 class_students 建立 attendance_records
- 避免重複產生

---

### Task 023｜建立手動產生場次按鈕

用途：

- MVP 階段先手動測試
- 之後改成排程自動執行

---

# Phase 6｜班級報到系統 MVP ✅

## 目標

先完成不用人臉辨識也能運作的報到系統。

---

### Task 024｜建立分校今日班級看板

頁面：`/branch-dashboard/:branchId`

顯示：

| 時間 | 班級 | 教室 | 應到 | 已到 | 未到 | 請假 | 遲到 | 狀態 |
|---|---|---|---:|---:|---:|---:|---:|---|

---

### Task 025｜建立班級報到頁

頁面：`/session/:sessionId`

顯示：

| 學生 | 狀態 | 報到時間 | 報到方式 | 操作 |
|---|---|---|---|---|

---

### Task 026｜建立手動報到功能

按鈕：

- 已報到
- 請假
- 未到
- 遲到

---

### Task 027｜建立遲到判斷邏輯

規則：

- 若 checkinTime > session.startTime + graceMinutes
- 狀態改為 LATE

`graceMinutes` 由 settings 控制。

---

### Task 028｜建立即時同步

使用 Firestore realtime listener。

需求：

- 某學生報到後
- 班級頁即時更新
- 分校 dashboard 即時更新

---

# Phase 7｜Kiosk 自助報到畫面 ✅

## 目標

建立報到機使用畫面，先支援手動 / 模擬報到，再接人臉辨識。

---

### Task 029｜建立 Kiosk Page

頁面：`/kiosk/:branchId`

狀態：

```text
待機
辨識中
報到成功
辨識失敗
請老師協助
```

---

### Task 030｜建立 Webcam Preview

功能：

- 開啟攝影機
- 顯示即時影像
- 擷取單張圖片

---

### Task 031｜建立 Kiosk session selector

用途：

- 報到機需知道目前要比對哪個分校、哪個時段的學生
- 可選擇「目前進行中或即將開始」的 sessions

---

# Phase 8｜人臉照片註冊模組 ✅

## 目標

管理學生人臉照片與 embedding。

---

### Task 032｜建立 face_profiles collection

欄位：

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

---

### Task 033｜建立 Storage 照片上傳功能

路徑：

```text
/branches/{branchId}/students/{studentId}/face_photos/{photoId}.jpg
```

---

### Task 034｜建立學生照片管理頁

功能：

- 上傳照片
- 顯示照片
- 停用照片
- 重新產生 embedding

---

### Task 035｜建立 Face Register API

Endpoint：

```text
POST /api/face/register
```

功能：

- 接收圖片
- 偵測是否只有一張臉
- 產生 embedding
- 回傳 qualityScore
- 寫入 face_profiles

---

# Phase 9｜人臉報到模組 ✅

## 目標

接上真正的人臉辨識報到。

---

### Task 036｜建立 Face Check-in API

Endpoint：

```text
POST /api/face/checkin
```

Request：

```json
{
  "branchId": "anhe",
  "sessionId": "20260427_C001",
  "imageBase64": "..."
}
```

Response：

```json
{
  "result": "SUCCESS",
  "matchedStudentId": "S001",
  "studentName": "王小明",
  "confidence": 0.89
}
```

---

### Task 037｜限制比對範圍

只比對：

```text
同分校
同 session
今日應到學生
active face_profiles
```

---

### Task 038｜建立信心值規則

規則：

```text
>= 0.85 自動報到
0.70 ~ 0.84 老師確認
< 0.70 失敗
```

---

### Task 039｜建立人工確認畫面

當中信心時，顯示：

```text
可能是：王小明
信心值：0.78
[確認報到] [不是此人]
```

---

### Task 040｜建立辨識失敗 fallback

顯示：

```text
無法辨識，請老師協助
```

老師可手動搜尋學生報到。

---

### Task 041｜建立 face_checkin_attempts collection

用途：記錄每次辨識結果，供後續改善。

```ts
{
  attemptId: string,
  branchId: string,
  sessionId: string,
  deviceId: string,
  matchedStudentId: string | null,
  confidence: number | null,
  result: 'SUCCESS' | 'NEED_CONFIRM' | 'FAILED',
  createdAt: timestamp
}
```

---

# Phase 10｜HQ Dashboard ✅

## 目標

讓總部看見所有分校狀態。

---

### Task 042｜建立 HQ Dashboard

頁面：`/hq-dashboard`

顯示：

| 分校 | 今日班級數 | 應到 | 已到 | 未到 | 請假 | 遲到 | 到班率 |
|---|---:|---:|---:|---:|---:|---:|---:|

---

### Task 043｜建立分校 Drill-down

點擊分校後進入：

```text
/branch-dashboard/:branchId
```

---

### Task 044｜建立異常提醒區

顯示：

- 未到人數過高班級
- 人臉辨識失敗次數過高
- 今日未完成點名班級

---

# Phase 11｜請假模組 🚧（已完整重新規劃）

## 目標

支援學員 / 行政請假流程，與 attendance_records 連動，並保留審核軌跡。

> 註：原始 spec 的 Task 045–047 編號已被 §M1 中段功能擴充使用。Phase 11 重新編號為 Task 067–071。

---

### Task 067｜建立 leave_requests collection 與服務 API

```ts
{
  leaveId: string,
  studentId: string,
  studentName: string,
  branchId: string,
  sessionId: string,
  classId: string,
  className: string,
  sessionDate: string,
  reason: string,
  status: 'pending' | 'approved' | 'rejected' | 'cancelled',
  createdBy: string,
  createdAt: timestamp,
  approvedBy: string | null,
  approvedAt: timestamp | null,
  rejectedReason: string | null,
}
```

服務 API（`src/services/leaves.ts`）：`createLeaveRequest`、`approveLeaveRequest`、`rejectLeaveRequest`、`cancelLeaveRequest`、`listLeavesByStudent`、`listLeavesBySession`、`listPendingLeaves`。

同步更新 `firestore.rules` 與 indexes。

---

### Task 068｜SessionPage 加入「請假」按鈕與表單

- 每位學生列「操作」欄新增請假按鈕
- 彈出表單：原因
- branch_admin / hq_admin 直接 approve；teacher / staff 預設 pending
- approve 時 atomic 寫入：建立 leave_requests + 更新該 attendance_records.status = 'LEAVE'、寫入 attendance_records.leaveId

---

### Task 069｜StudentDetailPage 請假紀錄分頁

- 新增「請假紀錄」Tab
- 列出該學員所有 leave_requests（日期、班級、原因、狀態、審核人）
- 提供 cancel 按鈕（pending 或場次未開始才允許）

---

### Task 070｜LeavesPage（總覽）

- 新增 `/leaves` 路由
- Filter：分校、學生、日期區間、狀態
- 列表顯示所有請假，支援 approve / reject pending 項目（依角色）

---

### Task 071｜attendance LEAVE 狀態防呆

- Firestore rules 限制：attendance_records 改為 `LEAVE` 必須由服務層的 batch（含 leaveId）寫入，不允許 client 直接寫狀態
- 對應 cancel 流程：若 leave 從 approved 改為 cancelled，且 session 尚未開始，將 attendance_records 由 `LEAVE` 還原為 `SCHEDULED`

---

# Phase 12｜通知模組 🚧

## 目標

加入 LINE / Email 通知能力。

---

### Task 072｜建立通知事件規則

事件：

- 報到成功
- 開課前未到
- 請假確認
- 遲到

---

### Task 073｜建立通知紀錄 collection

```ts
{
  notificationId: string,
  type: 'CHECKIN_SUCCESS' | 'ABSENT_ALERT' | 'LEAVE_APPROVED',
  target: string,
  channel: 'LINE' | 'EMAIL' | 'SMS',
  status: 'sent' | 'failed',
  createdAt: timestamp
}
```

---

### Task 074｜串接 LINE Messaging API

功能：

- 家長報到通知
- 老師未到提醒

---

# Phase 13｜報表分析 🚧

## 目標

產生營運 KPI。

---

### Task 075｜建立出席率報表

維度：

- 分校
- 班級
- 學生
- 期間

---

### Task 076｜建立人臉辨識品質報表

指標：

- 成功率
- 失敗率
- 人工確認率
- 常失敗學生名單

---

### Task 077｜建立缺席風險名單

規則：

- 連續缺席 2 次
- 近 30 天出席率低於 70%
- 請假頻率過高

---

# Phase 14｜系統設定 🚧（部分 ✅）

> graceMinutes 編輯已於 Task 066 完成。其餘設定為待開發。

---

### Task 078｜settings collection 補齊欄位

```ts
{
  branchId: string,
  graceMinutes: number,                         // ✅ Task 066
  faceAutoPassThreshold: number,                // 🚧
  faceConfirmThreshold: number,                 // 🚧
  checkinOpenBeforeMinutes: number,             // 🚧
  checkinCloseAfterMinutes: number              // 🚧
}
```

---

### Task 079｜設定頁補齊 UI

可設定：

- 人臉自動通過門檻
- 人工確認門檻
- 報到開放時間

---

# Phase 15｜測試與上線 🚧

## 目標

讓三間分校可實際試用。

---

### Task 080｜建立測試資料

建立：

- 3 間分校
- 每間 3 個班級
- 每班 10 位學生
- 每位學生 3 張人臉照片

---

### Task 081｜建立測試案例

測試情境：

- 正常人臉報到
- 辨識失敗改手動報到
- 中信心老師確認
- 請假學生不應報到
- 跨分校學生不可報到
- 同名學生不可誤判

---

### Task 082｜分校現場試跑

試跑場域：

- 安和分校
- 大直分校
- 延壽分校

觀察：

- 報到速度
- 老師操作便利性
- 人臉辨識成功率
- Kiosk 位置與光線
- 學生是否會正確站位

---

### Task 083｜MVP 上線檢查表

- 登入正常
- 權限正常
- 分校資料隔離正常
- 報到紀錄正常
- Dashboard 即時更新
- 人臉辨識可用
- 手動 fallback 可用
- Storage 照片可存取

---

# Phase 16｜班級定價模組 🚧

## 目標

為每個班級維護定價與計費方式，支援預估營收計算。

---

### Task 084｜建立 class_pricing collection 與服務 API

```ts
{
  pricingId: string,
  classId: string,
  branchId: string,
  price: number,
  priceType: 'per_month' | 'per_session' | 'per_class',
  currency: 'TWD',
  effectiveFrom: string,
  effectiveTo: string | null,
  notes?: string,
  createdBy: string,
  createdAt: timestamp,
  updatedAt: timestamp,
}
```

服務 API：`createClassPricing`、`updateClassPricing`、`getActivePricing(classId, asOf?)`、`listPricingByBranch`。
同步更新 firestore.rules / indexes。

---

### Task 085｜營收計算 utility

`calcMonthlyRevenue(classId)`：

```text
per_month   → price × 在班學員數
per_session → price × 在班學員數 × 預估月場次數
per_class   → price × 在班學員數 × 預估月堂數
```

「在班學員數」= class_students 中 active=true 的數量。

---

### Task 086｜ClassPricingPage（/class-pricing）

- 列出該分校所有班級的目前有效定價
- 欄位：班級代碼、班級名稱、計費方式、定價、目前人數、預估營收、生效起日、操作
- 列表底部顯示分校總預估營收

---

### Task 087｜新增 / 編輯定價對話框

- 計費方式 dropdown（per_month / per_session / per_class）
- effectiveFrom（calendar）、effectiveTo（可留空）
- 同 classId 在同一時間區間僅能有一筆有效定價（uniqueness validation）

---

### Task 088｜結束定價（end pricing）

- 列表上「結束」按鈕：將該筆 effectiveTo 設為今日
- 同時可選擇是否立刻新增下一筆生效定價（連續性）

---

# Phase 17｜課程方案模組（Course Program）🚧

## 目標

引入「課程方案 = 期數制 / 套裝課程」獨立於常態班級之外的排課與報名單位。

---

### Task 089｜建立 courses collection 與服務 API

詳見 `SAMS_engineering_spec.md` `courses` schema。
服務 API：CRUD + listByBranch + listByStatus。

---

### Task 090｜建立 course_modules collection 與服務 API

詳見 schema。每個課程方案可拆成多個模組。

---

### Task 091｜建立 course_sessions collection 與服務 API

每堂實際上課場次。提供批次建立功能（依 startDate / endDate / 週幾 / 時段自動展開）。

---

### Task 092｜建立 course_enrollments collection 與服務 API

學員報名。寫入時驗證：courseId 存在、該課程 status 為 enrolling 或 running、未超過 capacity、學員未重複報名。

---

### Task 093｜建立 course_attendance collection 與服務 API

每堂出席紀錄。結構與 attendance_records 相似，key 為 courseSessionId。

---

### Task 094｜CoursesPage（/courses）

- 列出課程方案（分校 / 狀態 / 期間 filter）
- 新增 / 編輯 / 複製課程方案

---

### Task 095｜CourseDetailPage（/courses/:courseId）

- Tab 1 課程資訊
- Tab 2 模組
- Tab 3 排課（含批次產生）
- Tab 4 報名清單
- Tab 5 出席統計

---

### Task 096｜CourseSessionPage（/course-session/:courseSessionId）

點名功能讀寫 `course_attendance`（與 SessionPage 相同 UX，不同 collection）。

---

### Task 097｜Kiosk 支援課程方案場次

- 自動掃描 `sessions` 與 `course_sessions`，取最早一場為當下報到目標
- 報到寫入時依場次來源寫入 `attendance_records` 或 `course_attendance`
- 比對範圍：本分校 + 該場次的應到 / 已報名學員

---

### Task 098｜Firestore rules + indexes 補齊

為 5 個新 collection 補上規則與必要 composite indexes（branchId+status、courseId+date 等）。

---

# Phase 18｜學員 Profile 類型 child / adult 🚧

## 目標

支援兒童 / 成人兩種學員類型，各自的專屬欄位。

---

### Task 099｜students 型別與 service 擴充

新增欄位：

```ts
profileType: 'child' | 'adult',
gender, birthday, phone, city, district, address, permanentAddress,
emergencyContactName, emergencyContactPhone, emergencyContactRelation,
notes,
childProfile?: { grade, school, parent1, parent2 },
adultProfile?: { education, graduateSchool, major, company, jobTitle, idNumber },
```

`createStudent` / `updateStudent` 寫入時驗證 profileType 對應 profile 物件的必填欄位。

---

### Task 100｜StudentFormDialog 條件顯示欄位

- 表單最上方加 profileType radio（child / adult）
- 切換時動態顯示對應欄位群
- legacy 欄位 grade / parentName / parentPhone 不再於 UI 出現，只在型別保留以讀取舊資料

---

### Task 101｜StudentsPage 列表欄位調整

- 顯示 `profileType` 標籤（兒童 / 成人）
- 兒童顯示年級 / 學校
- 成人顯示公司 / 職稱
- 搜尋條件：姓名、家長名稱（child）、公司（adult）

---

### Task 102｜StudentDetailPage 顯示對應 profile

- 兒童 Tab：年級、就讀學校、家長 1 / 家長 2
- 成人 Tab：學歷、畢業學校、科系、公司、職稱
- 共用 Tab：基本資料、地址、緊急聯絡人

---

### Task 103｜向下相容 lazy migration

- 讀取時：若文件無 profileType，視為 child；childProfile.grade 取 fallback `students.grade`
- 寫入時（用戶下次 save）：補齊 profileType 與對應 profile 物件
- 不做大批 backfill，不做硬性遷移

---

# 建議開發順序總表

| Phase | 名稱 | 優先度 | 狀態 |
|---|---|---|---|
| Phase 0 | 專案初始化 | P0 | ✅ |
| Phase 1 | 登入與權限 | P0 | ✅ |
| Phase 2 | 多分校基礎資料 | P0 | ✅ |
| Phase 3 | 學生資料管理 | P0 | ✅ |
| Phase 4 | 班級與排課 | P0 | ✅ |
| Phase 5 | 每日場次產生 | P0 | ✅ |
| Phase 6 | 手動報到 MVP | P0 | ✅ |
| Phase 7 | Kiosk 畫面 | P1 | ✅ |
| Phase 8 | 人臉照片註冊 | P1 | ✅ |
| Phase 9 | 人臉報到 | P1 | ✅ |
| Phase 10 | HQ Dashboard | P1 | ✅ |
| §M1 | 進階功能擴充 045–066 | P0 | ✅ |
| Phase 11 | 請假模組 | P1 | 🚧 |
| Phase 16 | 班級定價模組 | P1 | 🚧 |
| Phase 18 | 學員 Profile 類型 | P1 | 🚧 |
| Phase 12 | 通知模組 | P2 | 🚧 |
| Phase 13 | 報表分析 | P2 | 🚧 |
| Phase 14 | 系統設定（剩餘） | P2 | 🚧 |
| Phase 17 | 課程方案模組 | P2 | 🚧 |
| Phase 15 | 測試與上線 | P0 | 🚧 |

---

# 最小可上線版本 MVP Scope

第一版只做這些：

1. 登入
2. 多分校
3. 學生資料
4. 班級資料
5. 今日場次
6. 班級報到頁
7. 手動報到
8. Kiosk webcam
9. 人臉註冊
10. 人臉報到
11. HQ Dashboard 基礎版

---

# 不建議第一版做的功能

以下功能應延後：

- 家長 App
- 自動補課排程
- 複雜 CRM
- AI 缺席預測
- 課程銷售分析
- 多租戶 SaaS 計費

原因：

第一版的核心目標是驗證：

> 多分校 + 班級報到 + 人臉辨識 + 即時看板 是否能在現場穩定運作。

---

# 給 AI Coder 的開發原則

1. 每次只做一個 Task
2. 每個 Task 完成後要 commit
3. 每個 Phase 完成後要建立測試資料
4. 人臉辨識不要一開始就做，先完成手動報到流程
5. Firestore collection 命名必須固定
6. 權限規則不可最後才補，從 Phase 1 就要設計
7. Kiosk 必須保留人工 fallback

---

# Git Commit 建議

格式：

```text
feat(auth): add Firebase login flow
feat(branch): create branch CRUD
feat(attendance): add manual check-in
feat(face): implement face register API
fix(kiosk): handle webcam permission error
```

---

# 最終開發目標

完成後系統需支援：

- 三間分校同時使用
- 每日課程自動產生
- 學生可透過人臉報到
- 老師可手動修正狀態
- 總部可即時查看各分校報到狀況
- 所有照片存在 Firebase Storage
- 所有狀態資料存在 Firestore

