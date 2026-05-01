# 學生到校管理系統（補習班版門診報到系統）
## Product Specification v1.0

---

## 0. 文件目的

本文件定義一套多分校補習班使用之 **學生到校管理系統**。

系統核心概念類似醫院門診報到系統：

- 今日應到學生先產生名單
- 學生到校後完成報到
- 即時掌握已到 / 未到 / 請假 / 遲到
- 多分校同步管理
- 人臉辨識作為特色入口功能

---

## 1. 系統總覽（Main Spec）

### 1.1 系統名稱

**學生到校管理系統**  
Student Arrival Management System (**SAMS**)

### 1.2 系統定位

**補習班版門診報到系統**

適用：

- 多分校補習班
- STEAM 教育中心
- 安親班
- 才藝班
- 企業教育中心

### 1.3 核心價值

#### 現場端

- 老師即時知道誰到了
- 減少人工點名
- 降低櫃台壓力

#### 管理端

- 多分校即時監控
- 出席率分析
- 請假與遲到追蹤

#### 品牌端

- AI 人臉報到提升科技感
- 建立標準化營運 SOP

### 1.4 技術架構

```text
Frontend: React
Backend: Firebase + Python API
Database: Firestore
File Storage: Firebase Storage
Auth: Firebase Auth
Face Recognition: Python Module API
```

---

## 2. 系統模組總表

| 模組代號 | 模組名稱 |
|---|---|
| M01 | 使用者登入與權限模組 |
| M02 | 多分校管理模組 |
| M03 | 學生主檔模組（含 Profile 類型：兒童 / 成人） |
| M04 | 班級與課程模組 |
| M05 | 每日場次產生模組 |
| M06 | 報到管理模組 |
| M07 | 人臉辨識模組 |
| M08 | 請假模組 |
| M09 | Dashboard 看板模組 |
| M10 | 通知模組 |
| M11 | 報表分析模組 |
| M12 | 系統設定模組 |
| M13 | 班級定價模組 |
| M14 | 課程方案模組（Course Program） |

---

## 3. Main Flow

```text
排課資料
↓
產生今日場次
↓
建立應到名單
↓
學生到校報到
↓
更新狀態
↓
老師查看班級狀態
↓
總部查看分校狀態
↓
產出分析報表
```

---

# Sub Function Specs

## M01 使用者登入與權限模組

### 角色

- HQ_ADMIN
- BRANCH_ADMIN
- TEACHER
- STAFF
- KIOSK_DEVICE

### 權限規則

- **HQ_ADMIN**：可看所有分校
- **BRANCH_ADMIN**：只能看所屬分校
- **TEACHER**：只能看自己的班級
- **KIOSK_DEVICE**：只能執行報到功能

### 技術規格

- Firebase Auth
- Custom Claims Role Control

---

## M02 多分校管理模組

### 資料欄位

```json
{
  "branchId": "anhe",
  "name": "安和分校",
  "address": "台北市...",
  "status": "active"
}
```

### 功能

- 新增分校
- 停用分校
- 指派管理者
- 查看分校即時狀態

---

## M03 學生主檔模組

學員（student）有兩種 Profile 類型：

- **child**：學齡前 / 國中小 / 高中職 兒童或青少年
- **adult**：成人 / 在職 / 在學大學以上 / 企業學員

兩種類型共用核心欄位（studentId、name、branchId、phone、address、status…），各自擁有專屬欄位。

### 共用欄位

```json
{
  "studentId": "S001",
  "branchId": "anhe",
  "name": "王小明",
  "profileType": "child",
  "gender": "male",
  "birthday": "2014-03-21",
  "phone": "09xx",
  "city": "台北市",
  "district": "大安區",
  "address": "敦化南路一段...",
  "permanentAddress": "同上",
  "emergencyContactName": "王媽媽",
  "emergencyContactPhone": "09xx",
  "emergencyContactRelation": "母",
  "notes": "...",
  "status": "active"
}
```

### child 專屬欄位（profileType = "child"）

```json
{
  "childProfile": {
    "grade": "小三",
    "school": "敦化國小",
    "parent1": {
      "name": "王爸爸",
      "phone": "09xx",
      "relation": "父",
      "lineId": "..."
    },
    "parent2": {
      "name": "王媽媽",
      "phone": "09xx",
      "relation": "母",
      "lineId": "..."
    }
  }
}
```

### adult 專屬欄位（profileType = "adult"）

```json
{
  "adultProfile": {
    "education": "大學",
    "graduateSchool": "台灣大學",
    "major": "資訊工程",
    "company": "ABC 公司",
    "jobTitle": "工程師",
    "idNumber": "A12345...（加密儲存或僅在報表權限可讀）"
  }
}
```

### 向下相容規則

- 既有不帶 `profileType` 的學員資料，預設視為 `child`
- 既有舊欄位 `grade` / `parentName` / `parentPhone` 仍可讀；UI 顯示時優先讀 `childProfile.*`，缺失才 fallback 舊欄位
- Migration 採取 lazy 模式：學員下次被編輯時補齊 `profileType` 與對應 profile 物件，不做大批次 backfill

### 功能

- 新增學生（建立時即選擇 profileType）
- 修改學生（在 [編輯學生] 表單依 profileType 顯示對應欄位群）
- 停用 / 永久刪除學生
- 搜尋學生（姓名、學員編號、家長姓名 / 公司）
- 轉分校
- 上課記錄查詢（後續 Phase 補上）

---

## M04 班級與課程模組

```json
{
  "classId": "C001",
  "branchId": "anhe",
  "name": "Scratch 初階班",
  "teacherId": "T001",
  "weekday": 5,
  "startTime": "17:00",
  "endTime": "18:30"
}
```

### 功能

- 建立班級
- 指派老師
- 排課時間
- 教室設定
- 加入學生

---

## M05 每日場次產生模組

```json
{
  "sessionId": "20260427_C001",
  "classId": "C001",
  "branchId": "anhe",
  "date": "2026-04-27",
  "status": "waiting"
}
```

### 規則

- 每日凌晨產生未來 7 天場次

---

## M06 報到管理模組

### 狀態

- SCHEDULED
- CHECKED_IN
- LATE
- LEAVE
- ABSENT
- MAKEUP
- CANCELLED

```json
{
  "recordId": "R001",
  "sessionId": "20260427_C001",
  "studentId": "S001",
  "status": "CHECKED_IN",
  "checkinTime": "16:52:31",
  "method": "FACE"
}
```

### 功能

- 自助報到
- 手動報到
- 改狀態
- 查詢紀錄

---

## M07 人臉辨識模組（獨立模組）

### 架構

```text
React Kiosk
↓
Webcam
↓
Face Recognition API
↓
Firestore
```

### 子規格 07-1 註冊照片管理

- 每位學生可上傳 3~5 張照片
- 照片存於 Firebase Storage
- Metadata 存於 face_profiles

### 子規格 07-2 Embedding 產生

- 使用 Python `face_recognition`
- 照片轉為 128 維 embedding

### 子規格 07-3 比對流程

```text
擷取 webcam
↓
偵測人臉
↓
產生 embedding
↓
只比對：本分校 + 今日應到學生
↓
回傳最相近學生
```

### 子規格 07-4 信心值判定

- >= 0.85：直接報到
- 0.70 ~ 0.84：老師確認
- < 0.70：失敗，改手動

### 子規格 07-5 Fallback

- 老師手動選學生報到
- method = MANUAL

---

## M08 請假模組

### 資料結構

`leave_requests` collection：

```json
{
  "leaveId": "L0001",
  "studentId": "S001",
  "studentName": "王小明",
  "branchId": "anhe",
  "sessionId": "20260427_C001",
  "classId": "C001",
  "className": "Scratch 初階班",
  "sessionDate": "2026-04-27",
  "reason": "感冒",
  "status": "pending",
  "createdBy": "U001",
  "createdAt": "timestamp",
  "approvedBy": null,
  "approvedAt": null,
  "rejectedReason": null
}
```

`status`：`pending` | `approved` | `rejected` | `cancelled`。

### 服務 API（src/services/leaves.ts）

```ts
createLeaveRequest(input): Promise<LeaveDoc>
approveLeaveRequest(leaveId, operatorId): Promise<void>
rejectLeaveRequest(leaveId, operatorId, reason): Promise<void>
cancelLeaveRequest(leaveId, operatorId): Promise<void>
listLeavesByStudent(studentId, range?): Promise<LeaveDoc[]>
listLeavesBySession(sessionId): Promise<LeaveDoc[]>
listPendingLeaves(branchId?): Promise<LeaveDoc[]>
```

審核行為：

- `approve`：將 `attendance_records` 對應的 record 狀態由 `SCHEDULED` 改為 `LEAVE`，並寫回 `leaveId` 連結欄位（`attendance_records.leaveId`）。
- `reject`：不動 attendance；保留紀錄供後續查詢。
- `cancel`：學員 / 家長主動撤回；若先前已 approve 過，需同步將 attendance 由 `LEAVE` 還原為 `SCHEDULED`（限該場次尚未開始）。

### UI 流程

#### SessionPage（班級報到頁）

- 每位學生列在「操作」欄新增「請假」按鈕。
- 點擊後彈出表單：原因（textarea）、是否需審核（branch_admin / hq_admin 直接 approved；teacher / staff 預設 pending）。
- 送出後即時更新該學生狀態為 `LEAVE`（若已 approved）或在列表上加 `pending` 標籤。

#### StudentDetailPage（學生詳細頁）

- 新增「請假紀錄」分頁，列出該學員所有 `leave_requests`：
  - 日期 / 班級 / 場次 / 原因 / 狀態 / 審核人 / 操作（cancel / approve / reject）
- 行政可在此頁建立未來場次的預先請假（指定 sessionId）。

#### LeavesPage（總覽，後續 Phase 補）

- 分校 / HQ 角色可查所有請假，含 pending 待審。
- Filter：分校、學生、日期區間、狀態。

### 權限

- 家長端（後續 Phase）：可建立 pending leave。
- 老師 / 行政：可建立並 approve / reject 自己分校的學生。
- HQ：跨分校檢視與審核。
- attendance_records 的狀態變更必須透過服務 API，不允許 client 直接寫 `status: 'LEAVE'`，以保留審核軌跡。

---

## M09 Dashboard 看板模組

### HQ Dashboard

| 分校 | 應到 | 已到 | 未到 | 請假 |
|---|---:|---:|---:|---:|

### Branch Dashboard

| 班級 | 應到 | 已到 | 未到 |
|---|---:|---:|---:|

### Teacher Dashboard

| 學生 | 狀態 | 時間 |
|---|---|---|

---

## M10 通知模組

### 可整合

- LINE Notify / LINE API
- Email
- SMS

### 事件

- 報到成功通知家長
- 未到提醒老師
- 請假確認通知

---

## M11 報表分析模組

### KPI

- 到班率
- 缺席率
- 遲到率
- 班級穩定度
- 分校出席排名

---

## M12 系統設定模組

### 可設定

- 遲到幾分鐘判定
- 報到開放時間
- 人臉信心值門檻
- 分校營業時間

---

## M13 班級定價模組

### 目的

為每個班級記錄定價與計費方式，作為營收估算與後續開立收費單據的基礎。

### 資料結構

`class_pricing` collection：

```json
{
  "pricingId": "P0001",
  "classId": "C001",
  "branchId": "anhe",
  "price": 4500,
  "priceType": "per_month",
  "currency": "TWD",
  "effectiveFrom": "2026-04-01",
  "effectiveTo": null,
  "notes": "...",
  "createdBy": "U001",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

`priceType`：

- `per_month`：每月定額（不論上幾堂）
- `per_session`：每班次（一個 session 算一次）
- `per_class`：每堂（同 per_session 但語意指單堂課，跨多 session 班級用）

`effectiveFrom` 必填；`effectiveTo` 為 null 表示目前仍有效。同一 classId 在同一時間區間僅能有一筆有效定價。

### 服務 API（src/services/classPricing.ts）

```ts
createClassPricing(input): Promise<ClassPricingDoc>
updateClassPricing(pricingId, patch): Promise<void>
getActivePricing(classId, asOf?: Date): Promise<ClassPricingDoc | null>
listPricingByBranch(branchId): Promise<ClassPricingDoc[]>
```

### 營收計算邏輯

每個班級的「預估營收」依 priceType 不同：

```text
per_month   → price × 目前在班學員人數                （估每月收入）
per_session → price × 目前在班學員人數 × 預估月場次數
per_class   → price × 目前在班學員人數 × 預估月堂數
```

「在班人數」= `class_students` 中該 classId 且 active=true 的學員數。

### ClassPricingPage（/class-pricing）

- 顯示分校所有班級的目前有效定價
- 欄位：班級代碼、班級名稱、計費方式、定價、目前人數、預估營收、生效起日、操作
- 可新增 / 編輯 / 結束（將 effectiveTo 設為今日，並可同時新增下一筆生效定價）
- 列表底部顯示分校總預估營收
- 已從 spec 移除「生效起始月份 YYYY-MM / 生效結束月份留白」的舊設計，改用 effectiveFrom / effectiveTo 日期欄位

---

## M14 課程方案模組（Course Program）

### 目的

「班級（class）」是常態排課單位，「課程方案（course）」是時段制 / 期數制的套裝課程：

- 一個課程方案有固定起訖日、固定堂數、可包含多個模組（modules）
- 學員報名「課程方案」而不是「班級」
- 每堂課（course_session）獨立排課並記點名

適用情境：寒暑期班、密集班、企業內訓、檢定考衝刺班、營隊。

### 資料結構

#### courses

```json
{
  "courseId": "CR0001",
  "branchId": "anhe",
  "name": "2026 暑期 Python 密集班",
  "courseType": "Python 程式",
  "summary": "從零開始 60 小時掌握 Python",
  "startDate": "2026-07-01",
  "endDate": "2026-08-15",
  "totalHours": 60,
  "totalSessions": 30,
  "capacity": 20,
  "tuition": 18000,
  "tuitionType": "per_program",
  "instructorIds": ["T001", "T003"],
  "classroom": "101",
  "status": "draft",
  "createdAt": "timestamp"
}
```

`status`：`draft` | `enrolling` | `running` | `finished` | `cancelled`。
`tuitionType`：`per_program`（整期一次收）| `per_module`。

#### course_modules

一個課程方案可拆成多個模組（例如「基礎篇 / 專題篇」）：

```json
{
  "moduleId": "CM0001",
  "courseId": "CR0001",
  "name": "基礎篇",
  "orderIndex": 1,
  "totalSessions": 12,
  "totalHours": 24,
  "moduleTuition": 8000
}
```

#### course_sessions

每堂實際上課場次（取代 sessions collection 在課程方案下的角色，獨立 collection 以區分常態班 vs 課程方案）：

```json
{
  "courseSessionId": "CRS0001",
  "courseId": "CR0001",
  "moduleId": "CM0001",
  "branchId": "anhe",
  "date": "2026-07-01",
  "startTime": "09:00",
  "endTime": "11:00",
  "instructorId": "T001",
  "classroom": "101",
  "topic": "第 1 講：環境安裝與 Hello World",
  "status": "waiting"
}
```

#### course_enrollments

學員報名紀錄：

```json
{
  "enrollmentId": "EN0001",
  "courseId": "CR0001",
  "studentId": "S001",
  "branchId": "anhe",
  "enrolledAt": "timestamp",
  "tuitionPaid": 18000,
  "paymentStatus": "paid",
  "status": "active",
  "moduleIds": ["CM0001", "CM0002"],
  "notes": "..."
}
```

`status`：`active` | `withdrawn` | `completed`。
`paymentStatus`：`unpaid` | `partial` | `paid` | `refunded`。

#### course_attendance

每堂出席紀錄（與 attendance_records 結構相似，但 key 為 courseSessionId）：

```json
{
  "recordId": "CRA0001",
  "courseSessionId": "CRS0001",
  "courseId": "CR0001",
  "studentId": "S001",
  "studentName": "王小明",
  "status": "CHECKED_IN",
  "method": "FACE",
  "confidence": 0.91,
  "checkinTime": "timestamp",
  "operatorId": "U001"
}
```

### 頁面

#### CoursesPage（/courses）

- 列出所有課程方案（分校 filter、狀態 filter、期間 filter）
- 欄位：課程代碼、名稱、起訖日、總堂數、報名人數 / 容量、狀態
- 新增 / 編輯 / 複製課程方案

#### CourseDetailPage（/courses/:courseId）

- Tab 1 課程資訊：基本欄位、總堂數、講師
- Tab 2 模組（modules）：列出所有 course_modules
- Tab 3 排課（sessions）：列出所有 course_sessions，支援批次產生
- Tab 4 報名清單：列出 course_enrollments、可加入 / 退費 / 完成
- Tab 5 出席統計：每位學員的 attended / total、出席率

#### CourseSessionPage（/course-session/:courseSessionId）

- 同 SessionPage 的點名功能但讀寫 `course_attendance`
- 支援手動報到 / 請假 / 遲到 / 重設

#### Kiosk 整合

- Kiosk 自動找到「目前進行中或即將開始」的場次時，需同時掃描 `sessions`（常態班）與 `course_sessions`（課程方案），取最早一場為當下報到目標。
- 報到寫入時依場次來源寫到 `attendance_records` 或 `course_attendance`。
- 報到比對範圍同樣限制：本分校 + 該場次的應到 / 已報名學員。

---

## 4. Firestore Collections

```text
branches
users
students                 # 含 profileType: child | adult
instructors
classes
class_students
sessions
attendance_records
face_profiles
face_checkin_attempts
leave_requests
class_pricing
courses
course_modules
course_sessions
course_enrollments
course_attendance
app_options
settings
logs
```

---

## 5. Storage 結構

```text
/branches/anhe/students/S001/photo1.jpg
/branches/anhe/students/S001/photo2.jpg
/branches/dazhi/students/S888/photo1.jpg
```

---

## 6. MVP 第一階段

### 必做

- 多分校
- 今日看板
- 班級報到畫面
- 人臉報到
- 手動報到
- 請假功能

### 第二階段

- LINE 通知
- 家長 App
- KPI Dashboard
- 補課排程
- AI 預測缺席率

---

## 7. 非功能需求

### 效能

- 報到辨識 < 2 秒

### 穩定

- 即時同步

### 權限

- 分校資料隔離

### 安全

- 照片需登入授權

---

## 8. 開發優先順序

### Sprint 1

登入 + 分校 + 學生 + 班級

### Sprint 2

場次 + 報到 + Dashboard

### Sprint 3

人臉辨識

### Sprint 4

通知 + KPI

---

## 9. 一句話總結

> 本系統是一套多分校補習班版門診報到平台，以人臉辨識為特色入口，讓總部、分校、老師即時掌握學生到校狀態，建立可複製的營運管理制度。

