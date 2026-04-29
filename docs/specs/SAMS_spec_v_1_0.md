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
| M03 | 學生主檔模組 |
| M04 | 班級與課程模組 |
| M05 | 每日場次產生模組 |
| M06 | 報到管理模組 |
| M07 | 人臉辨識模組 |
| M08 | 請假模組 |
| M09 | Dashboard 看板模組 |
| M10 | 通知模組 |
| M11 | 報表分析模組 |
| M12 | 系統設定模組 |
| M13 | 班級定價表模組 |

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

### 欄位

```json
{
  "studentId": "S001",
  "name": "王小明",
  "grade": "小三",
  "branchId": "anhe",
  "parentName": "王媽媽",
  "phone": "09xx",
  "status": "active"
}
```

### 功能

- 新增學生
- 修改學生
- 停用學生
- 搜尋學生
- 轉分校

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

```json
{
  "studentId": "S001",
  "sessionId": "20260427_C001",
  "reason": "感冒",
  "status": "approved"
}
```

### 功能

- 家長請假
- 行政登錄
- 補課追蹤

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

## M13 班級定價表模組

### 用途

維護各班級的「每人費用」與計費方式，並依當前班級人數即時估算營收。屬營運分析輔助模組（不參與排課 / 報到流程）。

### 欄位

```json
{
  "pricingId": "PR000001",
  "classId": "C001",
  "branchId": "anhe",
  "className": "Scratch 初階班",
  "price": 3000,
  "priceType": "per_class | per_month | per_session | batch",
  "notes": "",
  "active": true
}
```

> `className` 為 denormalized 欄位（從 classes 寫入時複製進來），列表免再 join。

### 計費方式

| priceType | 顯示 | 說明 |
|---|---|---|
| `per_class` | 每班次 | 整個班次（一期）一筆費用 |
| `per_month` | 每月 | 每人每月收費 |
| `per_session` | 每堂 | 每人每堂收費 |
| `batch` | batch | 整批計費 |

### 功能

- 新增 / 編輯 / 停用定價（同一班級可有多筆，例如優惠價、舊價）
- 依分校、班名、啟用狀態篩選
- 列表顯示「目前人數 × 定價 = 預估營收」與啟用中合計
- 預估營收 = `price × 該班 class_students.active 人數`（client 端計算，不寫回）

### 權限

- `hq_admin`：所有分校
- `branch_admin`：本分校
- 其他角色：無導覽入口（路由也預設要登入）

---

## 4. Firestore Collections

```text
branches
users
students
classes
class_students
class_pricing
sessions
attendance_records
face_profiles
leave_requests
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

