// 分校新增 / 編輯表單（Task 010）

import { useEffect, useState, type FormEvent } from 'react';

import { Modal } from './Modal';
import { formStyles } from './formStyles';
import { createBranch, updateBranch } from '../services/branches';
import { isValidBranchId, type BranchDoc } from '../types/branch';

interface BranchFormDialogProps {
  open: boolean;
  initial: BranchDoc | null;
  onClose: () => void;
  onSaved: () => void;
}

export function BranchFormDialog({ open, initial, onClose, onSaved }: BranchFormDialogProps) {
  const isEdit = !!initial;
  const [branchId, setBranchId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBranchId(initial?.branchId ?? '');
    setName(initial?.name ?? '');
    setAddress(initial?.address ?? '');
    setError(null);
  }, [open, initial]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) {
      setError('請填寫分校名稱');
      return;
    }
    if (!isEdit && !isValidBranchId(branchId.trim().toLowerCase())) {
      setError('分校代碼格式錯誤（僅限小寫英數與「-」，2-30 字元）');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && initial) {
        await updateBranch(initial.branchId, { name, address });
      } else {
        await createBranch({ branchId, name, address });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title={isEdit ? '編輯分校' : '新增分校'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div style={formStyles.error}>{error}</div>}

        <div style={formStyles.field}>
          <label style={formStyles.label}>
            分校代碼<span style={formStyles.required}>*</span>
          </label>
          <input
            style={{ ...formStyles.input, ...(isEdit ? { background: '#f9fafb' } : null) }}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            placeholder="例：anhe"
            disabled={isEdit || submitting}
            required
          />
          <span style={formStyles.hint}>建立後不可修改；用於 URL 與資料關聯。</span>
        </div>

        <div style={formStyles.field}>
          <label style={formStyles.label}>
            分校名稱<span style={formStyles.required}>*</span>
          </label>
          <input
            style={formStyles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：安和分校"
            disabled={submitting}
            required
          />
        </div>

        <div style={formStyles.field}>
          <label style={formStyles.label}>地址</label>
          <input
            style={formStyles.input}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="例：台北市..."
            disabled={submitting}
          />
        </div>

        <div style={formStyles.actions}>
          <button type="button" style={formStyles.btnSecondary} onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button type="submit" style={formStyles.btnPrimary} disabled={submitting}>
            {submitting ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
