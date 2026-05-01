# SAMS Future Work / 待開發需求清單

> 這份文件記錄「尚未實作 / 待排入 task_breakdown」的功能需求。  
> 一旦某項目開始實作，把它從這裡搬到 `SAMS_task_breakdown.md` 並指派 Task 編號。

---

## 2026-05-01 Session — 學生 / 講師 UI 強化

來源：與 Joseph 對話討論。

### A. [編輯學生] 成人類型新增聯絡資訊欄位

**前提**：`profileType` (child / adult) 已在 `claude/busy-goldberg-9fce21` 分支實作，
此項需在含 profileType 的分支（或合併後的 main）上進行。

**修改範圍：**

1. `src/types/student.ts`  
   `adultProfile` 型別加入三個 optional string 欄位：
   - `mobilePhone?: string` — 手機
   - `homePhone?: string` — 家裡電話
   - `email?: string` — E-mail

2. `src/components/StudentFormDialog.tsx`  
   在 adultProfile 區塊新增三個輸入欄位：
   - 手機（mobilePhone）
   - 家裡電話（homePhone）
   - E-mail（email）

   建議排版：手機 / 家裡電話同列（flex），email 單獨一列（避免太擠）。

### B. [學生主檔] 成人 / 小朋友顯示差異

修改 `src/pages/StudentDetailPage.tsx`，依 `profileType` 切換「聯絡資訊」區塊：

| 區塊 | child（小朋友） | adult（成人） |
|---|---|---|
| 共用基本資料 | 姓名、學號、狀態、分校、性別、生日 | 同左 |
| 聯絡資訊 | 家長 1 姓名 / 電話<br>家長 2 姓名 / 電話 | 任職公司（company）<br>職稱（jobTitle）<br>手機（mobilePhone）<br>家裡電話（homePhone）<br>E-mail（email） |

設計原則：用 `profileType` 做條件判斷，
`child` → 渲染家長聯絡區塊，`adult` → 渲染公司聯絡區塊。

### C. [講師排課清單] 講師顯示格式

修改 `InstructorsPage.tsx` 或排課相關元件（如 `InstructorScheduleList`）：

- 講師「姓名」用正常字體（`font-normal` 或 `text-base`）
- 講師「編號」縮小顯示在姓名旁邊或下方（`text-xs text-gray-400`）
- 範例呈現：`Joseph  T001`（姓名前置、編號淡灰縮小）

目的：表格中讓人優先看到姓名、編號變成輔助資訊。

---

## 待補：Task 編號分配

上述 A / B / C 待併入 `SAMS_task_breakdown.md`，建議放在 Phase 16 之後或現有
「學生模組強化」段落，編號可採 Task 067~069（請依當下 task_breakdown 已用的編號續排）。

---

## 工作流程提醒

依 user memory `feedback_deploy_full.md`：
- 「部署」一律 = `firebase deploy rules` + `npm run build` + `firebase deploy hosting` 三步
- 新增 collection 必須同步補 `firestore.rules`，否則會 permissions error
- 每個 Task 完成後 commit；commit 落在 `claude/xxx` 分支，需 merge 回 main 才會反映在 user 看到的 working tree
