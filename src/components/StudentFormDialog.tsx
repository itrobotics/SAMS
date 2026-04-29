// 學生新增 / 編輯表單（Task 013）

import { useEffect, useState, type FormEvent } from 'react';

import { Modal } from './Modal';
import { formStyles } from './formStyles';
import { useBranches } from '../hooks/useBranches';
import { createStudent, deleteStudent, updateStudent } from '../services/students';
import { STUDENTS_COLLECTION, isValidStudentId, type StudentDoc } from '../types/student';
import { getNextId } from '../utils/autoId';

interface StudentFormDialogProps {
  open: boolean;
  initial: StudentDoc | null;
  defaultBranchId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function StudentFormDialog({
  open,
  initial,
  defaultBranchId,
  onClose,
  onSaved,
}: StudentFormDialogProps) {
  const isEdit = !!initial;
  const { branches } = useBranches(true);

  const [studentId, setStudentId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!initial) {
      getNextId('S', STUDENTS_COLLECTION).then(setStudentId).catch(() => {});
    } else {
      setStudentId(initial.studentId);
    }
    setBranchId(initial?.branchId ?? defaultBranchId ?? '');
    setName(initial?.name ?? '');
    setGrade(initial?.grade ?? '');
    setParentName(initial?.parentName ?? '');
    setParentPhone(initial?.parentPhone ?? '');
    setActive(initial?.active ?? true);
    setError(null);
  }, [open, initial, defaultBranchId]);

  // 開啟新增表單時，若分校還沒選過且只有一個分校可選，就自動帶入。
  useEffect(() => {
    if (!open || isEdit) return;
    if (!branchId && branches.length === 1) setBranchId(branches[0].branchId);
  }, [open, isEdit, branchId, branches]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!isEdit && !isValidStudentId(studentId.trim())) {
      setError('學號格式錯誤（僅限英數、_、-，2-30 字元）');
      return;
    }
    if (!branchId) {
      setError('請選擇分校');
      return;
    }
    if (!name.trim()) {
      setError('請填寫姓名');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && initial) {
        await updateStudent(initial.studentId, {
          branchId,
          name,
          grade,
          parentName,
          parentPhone,
          active,
        });
      } else {
        await createStudent({ studentId, branchId, name, grade, parentName, parentPhone });
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
    <Modal open={open} title={isEdit ? '編輯學生' : '新增學生'} onClose={onClose} width={520}>
      <form onSubmit={handleSubmit}>
        {error && <div style={formStyles.error}>{error}</div>}

        <div style={formStyles.field}>
          <label style={formStyles.label}>
            學號<span style={formStyles.required}>*</span>
          </label>
          <input
            style={{ ...formStyles.input, background: '#f9fafb' }}
            value={studentId}
            readOnly
            placeholder="載入中…"
            disabled={submitting}
            required
          />
          {!isEdit && (
            <span style={formStyles.hint}>系統自動帶入，建立後不可修改。</span>
          )}
        </div>

        <div style={formStyles.field}>
          <label style={formStyles.label}>
            分校<span style={formStyles.required}>*</span>
          </label>
          <select
            style={formStyles.select}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={submitting}
            required
          >
            <option value="">請選擇</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId}>
                {b.name}（{b.branchId}）
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 2 }}>
            <label style={formStyles.label}>
              姓名<span style={formStyles.required}>*</span>
            </label>
            <input
              style={formStyles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：王小明"
              disabled={submitting}
              required
            />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>年級</label>
            <input
              style={formStyles.input}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="例：小三"
              disabled={submitting}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>家長姓名</label>
            <input
              style={formStyles.input}
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="例：王媽媽"
              disabled={submitting}
            />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>家長電話</label>
            <input
              style={formStyles.input}
              type="tel"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              placeholder="例：09xxxxxxxx"
              disabled={submitting}
            />
          </div>
        </div>

        {isEdit && (
          <div style={formStyles.field}>
            <label style={{ ...formStyles.label, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                disabled={submitting}
              />
              啟用此學生（取消勾選等同停用）
            </label>
          </div>
        )}

        <div style={{ ...formStyles.actions, justifyContent: 'space-between' }}>
          <div>
            {isEdit && initial && (
              <button
                type="button"
                style={formStyles.btnDanger}
                disabled={submitting}
                onClick={async () => {
                  if (!window.confirm(`確定要永久刪除學生「${initial.name}」？\n\n此操作無法復原，歷史出席紀錄仍會保留。`)) return;
                  setSubmitting(true);
                  try {
                    await deleteStudent(initial.studentId);
                    onSaved();
                    onClose();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : '刪除失敗');
                    setSubmitting(false);
                  }
                }}
              >
                刪除學生
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" style={formStyles.btnSecondary} onClick={onClose} disabled={submitting}>
              取消
            </button>
            <button type="submit" style={formStyles.btnPrimary} disabled={submitting}>
              {submitting ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
