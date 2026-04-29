# 學生到校管理系統｜Task Breakdown + 開發順序
## ICE SAMS Development Plan v1.0

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

# Phase 0｜專案初始化

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

# Phase 1｜登入與權限

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

# Phase 2｜多分校基礎資料

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

# Phase 3｜學生資料管理

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

# Phase 4｜班級與排課

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

# Phase 5｜每日場次產生

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

# Phase 6｜班級報到系統 MVP

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

# Phase 7｜Kiosk 自助報到畫面

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

# Phase 8｜人臉照片註冊模組

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

# Phase 9｜人臉報到模組

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

# Phase 10｜HQ Dashboard

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

# Phase 11｜請假模組

## 目標

支援學生請假狀態。

---

### Task 045｜建立 leave_requests collection

```ts
{
  leaveId: string,
  studentId: string,
  branchId: string,
  sessionId: string,
  reason: string,
  status: 'pending' | 'approved' | 'rejected',
  createdAt: timestamp,
  approvedBy: string | null
}
```

---

### Task 046｜建立行政請假登錄頁

功能：

- 選學生
- 選場次
- 填原因
- 送出後 attendance_records 改為 LEAVE

---

### Task 047｜建立請假列表

顯示：

- 日期
- 學生
- 班級
- 原因
- 狀態

---

# Phase 12｜通知模組

## 目標

加入 LINE / Email 通知能力。

---

### Task 048｜建立通知事件規則

事件：

- 報到成功
- 開課前未到
- 請假確認
- 遲到

---

### Task 049｜建立通知紀錄 collection

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

### Task 050｜串接 LINE Messaging API

功能：

- 家長報到通知
- 老師未到提醒

---

# Phase 13｜報表分析

## 目標

產生營運 KPI。

---

### Task 051｜建立出席率報表

維度：

- 分校
- 班級
- 學生
- 期間

---

### Task 052｜建立人臉辨識品質報表

指標：

- 成功率
- 失敗率
- 人工確認率
- 常失敗學生名單

---

### Task 053｜建立缺席風險名單

規則：

- 連續缺席 2 次
- 近 30 天出席率低於 70%
- 請假頻率過高

---

# Phase 14｜系統設定

## 目標

讓管理者調整規則。

---

### Task 054｜建立 settings collection

```ts
{
  branchId: string,
  graceMinutes: number,
  faceAutoPassThreshold: number,
  faceConfirmThreshold: number,
  checkinOpenBeforeMinutes: number,
  checkinCloseAfterMinutes: number
}
```

---

### Task 055｜建立設定頁

可設定：

- 遲到寬限分鐘
- 人臉自動通過門檻
- 人工確認門檻
- 報到開放時間

---

# Phase 15｜測試與上線

## 目標

讓三間分校可實際試用。

---

### Task 056｜建立測試資料

建立：

- 3 間分校
- 每間 3 個班級
- 每班 10 位學生
- 每位學生 3 張人臉照片

---

### Task 057｜建立測試案例

測試情境：

- 正常人臉報到
- 辨識失敗改手動報到
- 中信心老師確認
- 請假學生不應報到
- 跨分校學生不可報到
- 同名學生不可誤判

---

### Task 058｜分校現場試跑

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

### Task 059｜MVP 上線檢查表

- 登入正常
- 權限正常
- 分校資料隔離正常
- 報到紀錄正常
- Dashboard 即時更新
- 人臉辨識可用
- 手動 fallback 可用
- Storage 照片可存取

---

# Phase 16｜MVP 後續優化

## 目標

MVP 主流程上線後逐步加入的營運與管理輔助功能。涵蓋共用基礎（自動代碼、選項管理、台灣地址）、主檔資料擴充（講師 / 學生 / 分校 / 班級）、進階模組（定價表、講師排課清單、期間 filter 統一）。

開發順序與 commit 上的 Task 編號一致（Task 045 ~ Task 066）。本 phase 與排課 / 報到主流程獨立，可分階段交付。

> 本 phase 期間另有數筆未編號的修補 commit（如「strip undefined meeting fields」、「add Firestore rules for instructors and app_options」、「support multiple meetings per class with per-meeting overrides」），不另列為 Task。

## Tasks

### Task 045｜建立 app_options collection 與選項管理頁

新增 `app_options` collection 作為共用下拉選單來源；每個 doc 代表一類選項。

```ts
{
  key: string,            // doc ID（如 'courses'）
  label: string,
  values: string[],
  updatedAt: timestamp
}
```

預設 doc：

- `courses` — 講師可教授課程
- `relationships` — 緊急聯絡人關係

新頁面 `/options`（HQ Admin 限定），可新增 / 刪除 / 排序選項。

---

### Task 046｜建立講師管理 CRUD

新增 `instructors` collection 與 `/instructors` 頁面。欄位：基本資料 / 學歷 / 聯絡方式 / 緊急聯絡人 / 鐘點 / 累計教學時數。

`instructorId` 採 `Tnnn` 流水號自動產生（透過 Task 047 的 helper）。

---

### Task 047｜自動產生主檔代碼

新增 `src/utils/autoId.ts`：掃 collection 找最大 `${prefix}\d+` 後 +1，補零至 3 位。

`studentId` / `classId` / `instructorId` 新增時自動帶入；使用者仍可改。

---

### Task 048｜班級列表顯示學生人數

新增 `fetchAllActiveClassStudentCounts(): Promise<Map<string, number>>`，aggregate `class_students` 啟用人數。

ClassesPage 一次性 fetch（非訂閱）並在每列顯示「學生人數」。

---

### Task 049｜支援跨分校加入學生

班級學生管理頁加分校 filter（HQ 預設「全部分校」），移除原本「只能加同分校學生」的限制。`class_students.branchId` 仍寫入，方便日後 server-side 隔離。

---

### Task 050｜講師擴充欄位

加入：性別、通訊地址（縣市 / 區 / 詳址分離）、戶籍地址（含「同通訊」勾選）、鐘點 `hourlyRate`、累計教學時數 `totalTeachingHours`、備註。

---

### Task 051｜學生編輯支援永久刪除

`StudentFormDialog` 加紅色「刪除」按鈕（雙確認）；同時清掉該學生的 `class_students` 關聯。

---

### Task 052｜app_options 加 courseTypes

`app_options` 新增 `courseTypes` doc，預設 19 種課程類型（micro:bit / 科學實驗 / MPM / Scratch …）。`OPTION_LABELS.courseTypes = '課程類型（班級）'`。

---

### Task 053｜班級表單改用講師下拉與課程類型下拉

`ClassFormDialog` 移除 `teacherId` 文字輸入，改 `subscribeInstructors({ activeOnly: true })` 下拉；課程類型也改下拉（讀 `app_options.courseTypes`）。

---

### Task 054｜台灣縣市行政區資料與 TaiwanAddressFields component

- 新增 `src/utils/taiwanAddress.ts` — 縣市 → 區陣列查表
- 新增 `src/components/TaiwanAddressFields.tsx` — 共用元件，給 student / instructor 表單用

---

### Task 055｜班級列表顯示「T001-Joseph」格式

ClassesPage 用 instructor map 顯示「ID-姓名」，未指定講師則「—」。

---

### Task 056｜學生擴充欄位

加入：性別、生日、通訊地址（縣市 / 區 / 詳址）、戶籍地址（含「同通訊」勾選）、緊急聯絡人（姓名 + 關係）、備註。改用 `<TaiwanAddressFields>`。

---

### Task 057｜講師加生日 + 行政區欄位

instructors 加 `birthday`；地址改用 `<TaiwanAddressFields>`（縣市 / 區 / 詳址三段）。

---

### Task 058｜班級加課程起訖日 / 時數 / 新增模式啟用 toggle

`ClassDoc` 加：

- `courseStartDate: 'YYYY-MM-DD'`
- `courseEndDate: 'YYYY-MM-DD'`
- `courseHours: number`

`ClassFormDialog` 新增模式也顯示「啟用」checkbox（先前只有編輯模式）。

---

### Task 059｜班級時段顯示優化

班級列表 meeting 顯示為「週二 18:00–18:30（講師 T003 matt | 教室 101）」。即時 join `instructors` 與 meeting override，可一眼看出每個時段的負責講師與教室。

> 註：早期 task breakdown 把 Task 059 標為「MVP 上線檢查表」（見上），實際開發時 Task 059 編號被用在這個 UI 改動。檢查表項目仍適用於 MVP 上線，但未做為單一 commit。

---

### Task 060｜班級欄位改名與多重 filter

- 「老師」→「上課講師」（單一班級可多講師）
- ClassesPage 加：期間 filter / 講師代碼或姓名搜尋
- `formatTeachers()` 列出該班所有講師（預設 `teacherId` + 各 meeting `teacherId` override，去重）

---

### Task 061｜講師排課清單頁

新頁面 `/instructor-schedule`：列出某講師被排在哪些班級的哪些時段（預設 + meeting override）。篩選：講師 / 期間 / 啟用狀態。

---

### Task 062｜全 UI 將「老師」改為「講師」

全域 string replace（UI label / 註解 / hint），底層欄位名 `teacherId` 不動以維持 schema 穩定。

---

### Task 063｜分校加客服電話、主任資訊、備註欄位

`branches` 加：

```ts
{
  servicePhone: string,    // 客服電話
  directorName: string,    // 主任姓名
  directorPhone: string,   // 主任手機
  directorLineId: string,  // 主任 Line ID
  notes: string            // 備註
}
```

---

### Task 064｜分校列表顯示 servicePhone 與 directorName

BranchesPage 新增兩欄，方便分校頁一眼看出聯絡資訊。

---

### Task 065｜建立班級定價表模組

對應產品 spec **M13 班級定價表模組**。

新增檔案：

- `src/types/classPricing.ts` — `ClassPricingDoc` 型別、`PriceType` 列舉
- `src/services/classPricing.ts` — Firestore CRUD + `subscribeClassPricing({ branchIds, classId?, activeOnly? })`，內建 6 位 `PRnnnnnn` 流水號產生器
- `src/components/ClassPricingFormDialog.tsx` — 新增 / 編輯表單
- `src/pages/ClassPricingPage.tsx` — 列表 + 篩選 + 預估營收

修改檔案：

- `src/routes/paths.ts` — 加入 `classPricing: '/class-pricing'`
- `src/routes/AppRouter.tsx` — 註冊路由
- `src/components/AppLayout.tsx` — 導覽列加「定價表」（HQ Admin / Branch Admin 可見）
- `firestore.rules` — 加入 `class_pricing` collection 規則（沿用「登入即可讀寫」）

#### Firestore：`class_pricing`

```ts
{
  pricingId: string,                                       // 自動產生 PRnnnnnn
  classId: string,
  branchId: string,
  className: string,                                        // denormalized
  price: number,                                            // TWD，每人費用
  priceType: 'per_class' | 'per_month' | 'per_session',
  notes: string,
  active: boolean,
  createdAt: timestamp,
  createdBy: string
}
```

#### 計費方式

- **per_class — 每班次**：整個班次（一期）一筆費用
- **per_month — 每月**：每人每月收費
- **per_session — 每堂**：每人每堂收費

#### 列表欄位

| 班級名稱 | 分校 | 定價/人 | 計費方式 | 目前人數 | 預估營收 | 狀態 | 操作 |

- 預估營收 = `price × class_students.active 人數`（client 端計算）
- header 顯示「啟用中預估營收合計 NT$ ...」

#### 篩選

- 分校（角色過濾後）
- 班級名稱（client 端 substring）
- 啟用狀態：啟用中（預設）/ 已停用 / 全部

#### 設計決策

- 同一 classId 可有多筆定價（例如優惠價、舊價、不同方案）；不以「生效期間」區分，改以 `active` 控制是否納入估算
- `className` denormalized，列表免再 join classes
- `pricingId` 用 6 位流水號（`autoId.ts` 只支援 3 位，service 內建獨立生成器）

---

### Task 066｜統一班級期間 Filter

#### 動機

ClassesPage 與 InstructorSchedulePage 原本各自實作「今日 / 本週 / 本月 / 上月 / 下月 / 自訂期間」加上自訂日期區間 UI；經實際使用後改為 6 個固定 preset，邏輯改成「指定欄位的月 / 季是否落在某個月 / 季」。

#### 期間選項（兩頁共用）

| 選項 | 規則 |
|---|---|
| 全部（預設） | 不過濾 |
| 本月開課 | 月(`courseStartDate`) === 本月 |
| 本月結束 | 月(`courseEndDate`) === 本月 |
| 上月開課 | 月(`courseStartDate`) === 上月 |
| 下月結束 | 月(`courseEndDate`) === 下月 |
| 本季開課 | 季(`courseStartDate`) === 本季 |
| 本季結束 | 季(`courseEndDate`) === 本季 |

> 季：1-3 月 = Q1，4-6 月 = Q2，7-9 月 = Q3，10-12 月 = Q4。
> 未填對應日期的班級在非「全部」preset 下會被排除。

#### 新增 / 修改檔案

- 新增 `src/utils/coursePeriodFilter.ts` — `CoursePeriodPreset` 型別、`COURSE_PERIOD_OPTIONS` 陣列、`matchesCoursePeriod(preset, courseStartDate, courseEndDate, now?)`
- 修改 `src/pages/ClassesPage.tsx` 與 `src/pages/InstructorSchedulePage.tsx`：移除舊 `getPresetRange` / `overlapsPeriod` / 自訂日期區間 UI，改用共用 util

---

# 建議開發順序總表

| Phase | 名稱 | 優先度 |
|---|---|---|
| Phase 0 | 專案初始化 | P0 |
| Phase 1 | 登入與權限 | P0 |
| Phase 2 | 多分校基礎資料 | P0 |
| Phase 3 | 學生資料管理 | P0 |
| Phase 4 | 班級與排課 | P0 |
| Phase 5 | 每日場次產生 | P0 |
| Phase 6 | 手動報到 MVP | P0 |
| Phase 7 | Kiosk 畫面 | P1 |
| Phase 8 | 人臉照片註冊 | P1 |
| Phase 9 | 人臉報到 | P1 |
| Phase 10 | HQ Dashboard | P1 |
| Phase 11 | 請假模組 | P1 |
| Phase 12 | 通知模組 | P2 |
| Phase 13 | 報表分析 | P2 |
| Phase 14 | 系統設定 | P2 |
| Phase 15 | 測試與上線 | P0 |
| Phase 16 | MVP 後續優化（Task 045-066：選項管理、講師、地址、班級擴充、定價、期間 filter） | P2 |

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

