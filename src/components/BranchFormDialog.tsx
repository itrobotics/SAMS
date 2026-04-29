// 分校新增 / 編輯表單（Task 010, updated Task 063）

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
  const [servicePhone, setServicePhone] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [directorPhone, setDirectorPhone] = useState('');
  const [directorLineId, setDirectorLineId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBranchId(initial?.branchId ?? '');
    setName(initial?.name ?? '');
    setAddress(initial?.address ?? '');
    setServicePhone(initial?.servicePhone ?? '');
    setDirectorName(initial?.directorName ?? '');
    setDirectorPhone(initial?.directorPhone ?? '');
    setDirectorLineId(initial?.directorLineId ?? '');
    setNotes(initial?.notes ?? '');
    setError(null);
  }, [open, initial]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) { setError('請填寫分校名稱'); return; }
    if (!isEdit && !isValidBranchId(branchId.trim().toLowerCase())) {
      setError('分校代碼格式錯誤（僅限小寫英數與「-」，2-30 字元）');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = { name, address, servicePhone, directorName, directorPhone, directorLineId, notes };
      if (isEdit && initial) {
        await updateBranch(initial.branchId, payload);
      } else {
        await createBranch({ branchId, ...payload });
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
    <Modal open={open} title={isEdit ? '編輯分校' : '新增分校'} onClose={onClose} width={520}>
      <form onSubmit={handleSubmit}>
        {error && <div style={formStyles.error}>{error}</div>}

        {/* 分校代碼 + 名稱 */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
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
            {!isEdit && <span style={formStyles.hint}>建立後不可修改；用於 URL 與資料關聯。</span>}
          </div>
          <div style={{ ...formStyles.field, flex: 2 }}>
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
        </div>

        {/* 地址 */}
        <div style={formStyles.field}>
          <label style={formStyles.label}>地址</label>
          <input
            style={formStyles.input}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="例：台北市大安區..."
            disabled={submitting}
          />
        </div>

        {/* 客服電話 */}
        <div style={formStyles.field}>
          <label style={formStyles.label}>客服電話</label>
          <input
            type="tel"
            style={formStyles.input}
            value={servicePhone}
            onChange={(e) => setServicePhone(e.target.value)}
            placeholder="例：02-12345678"
            disabled={submitting}
          />
        </div>

        {/* 主任資訊 */}
        <div style={sectionTitle}>主任資訊</div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>主任姓名</label>
            <input
              style={formStyles.input}
              value={directorName}
              onChange={(e) => setDirectorName(e.target.value)}
              placeholder="例：王主任"
              disabled={submitting}
            />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>主任手機</label>
            <input
              type="tel"
              style={formStyles.input}
              value={directorPhone}
              onChange={(e) => setDirectorPhone(e.target.value)}
              placeholder="例：09xxxxxxxx"
              disabled={submitting}
            />
          </div>
        </div>
        <div style={formStyles.field}>
          <label style={formStyles.label}>主任 Line ID</label>
          <input
            style={formStyles.input}
            value={directorLineId}
            onChange={(e) => setDirectorLineId(e.target.value)}
            placeholder="例：director_line"
            disabled={submitting}
          />
        </div>

        {/* 備註 */}
        <div style={formStyles.field}>
          <label style={formStyles.label}>備註</label>
          <textarea
            style={{ ...formStyles.input, height: 72, resize: 'vertical' } as React.CSSProperties}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="其他說明…"
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

const sectionTitle: React.CSSProperties = {
  fontSize: '0.8rem', fontWeight: 600, color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid #e5e7eb', paddingBottom: '0.3rem',
  marginBottom: '0.75rem',
};
