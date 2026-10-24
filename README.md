# SAMS（功能已停用，保留作為前端 UI 參考）

> ℹ️ **本系統的功能已由 [itrobotics/iITS](https://github.com/itrobotics/iITS) 取代，請勿再當作正式系統維護或部署。**
>
> 本 repo **刻意保留、不封存**，原因是它的前端介面要給 **人臉報到系統** 仿照。
> 技術棧為 React + Vite + Firebase，介面做得相對完整，可直接參考改寫。

## 給人臉報到系統參考的部分

報到流程最可直接借用的現成元件／頁面：

| 檔案 | 用途 |
|---|---|
| `src/pages/KioskPage.tsx` | Kiosk（報到機）主頁版型 |
| `src/components/KioskSessionSelector.tsx` | 報到時選擇梯次／場次 |
| `src/components/StudentFacePhotos.tsx` | 學員人臉照片的呈現與管理 |
| `src/components/AppLayout.tsx` | 整體框架（側欄 + 內容區） |
| `src/components/Modal.tsx`、`src/components/formStyles.ts` | 共用對話框與表單樣式 |

整體角色與權限、頁面導覽的做法見 `docs/specs/`。

## 原始說明

學員管理系統（Student / Academy Management System），涵蓋分校、班級、課程、
學員、講師、排課、就業追蹤、滿意度問卷等模組。操作手冊見 `docs/SAMS_使用者操作手冊.html`。
