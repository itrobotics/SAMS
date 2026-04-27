// settings collection 型別定義（為 Phase 14 預留 + Task 027 預設值）
//
// Firestore 路徑：`settings/{branchId}`，目前 Phase 6 只用到 graceMinutes。
// Phase 14（Task 054）會把整份設定接到 UI；目前若分校沒有設定，
// 統一回傳 DEFAULT_BRANCH_SETTINGS。

export interface BranchSettings {
  branchId: string;
  graceMinutes: number;            // 上課後幾分鐘內仍視為「準時」
  faceAutoPassThreshold: number;   // ≥ 視為自動通過
  faceConfirmThreshold: number;    // ≥ 但 < auto-pass：人工確認
  checkinOpenBeforeMinutes: number;
  checkinCloseAfterMinutes: number;
}

export const SETTINGS_COLLECTION = 'settings';

export const DEFAULT_BRANCH_SETTINGS: Omit<BranchSettings, 'branchId'> = {
  graceMinutes: 10,
  faceAutoPassThreshold: 0.85,
  faceConfirmThreshold: 0.70,
  checkinOpenBeforeMinutes: 30,
  checkinCloseAfterMinutes: 60,
};
