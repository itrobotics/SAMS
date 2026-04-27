// 班級新增 / 編輯表單（Task 018）

import { useEffect, useState, type FormEvent } from 'react';

import { Modal } from './Modal';
import { formStyles } from './formStyles';
import { useBranches } from '../hooks/useBranches';
import { createClass, updateClass } from '../services/classes';
import {
  WEEKDAY_LABELS,
  isValidClassId,
  type ClassDoc,
} from '../types/class';

interface ClassFormDialogProps {
  open: boolean;
  initial: ClassDoc | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ClassFormDialog({ open, initial, onClose, onSaved }: ClassFormDialogProps) {
  const isEdit = !!initial;
  const { branches } = useBranches(true);

  const [classId, setClassId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [name, setName] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [classroom, setClassroom] = useState('');
  const [weekday, setWeekday] = useState<number>(1);
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('18:30');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setClassId(initial?.classId ?? '');
    setBranchId(initial?.branchId ?? '');
    setName(initial?.name ?? '');
    setTeacherId(initial?.teacherId ?? '');
    setClassroom(initial?.classroom ?? '');
    setWeekday(initial?.weekday ?? 1);
    setStartTime(initial?.startTime ?? '17:00');
    setEndTime(initial?.endTime ?? '18:30');
    setActive(initial?.active ?? true);
    setError(null);
  }, [open, initial]);

  useEffect(() => {
    if (!open || isEdit) return;
    if (!branchId && branches.length === 1) setBranchId(branches[0].branchId);
  }, [open, isEdit, branchId, branches]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!isEdit && !isValidClassId(classId.trim())) {
      setError('班級代碼格式錯誤（僅限英數、_、-，2-30 字元）');
      return;
    }
    if (!branchId) return setError('請選擇分校');
    if (!name.trim()) return setError('請填寫班級名稱');
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && initial) {
        await updateClass(initial.classId, {
          branchId, name, teacherId, classroom, weekday, startTime, endTime, active,
        });
      } else {
        await createClass({
          classId, branchId, name, teacherId, classroom, weekday, startTime, endTime,
        });
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
    <Modal open={open} title={isEdit ? '編輯班級' : '新增班級'} onClose={onClose} width={560}>
      <form onSubmit={handleSubmit}>
        {error && <div style={formStyles.error}>{error}</div>}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>班級代碼<span style={formStyles.required}>*</span></label>
            <input
              style={{ ...formStyles.input, ...(isEdit ? { background: '#f9fafb' } : null) }}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              placeholder="例：C001"
              disabled={isEdit || submitting}
              required
            />
          </div>
          <div style={{ ...formStyles.field, flex: 2 }}>
            <label style={formStyles.label}>班級名稱<span style={formStyles.required}>*</span></label>
            <input
              style={formStyles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：Scratch 初階班"
              disabled={submitting}
              required
            />
          </div>
        </div>

        <div style={formStyles.field}>
          <label style={formStyles.label}>分校<span style={formStyles.required}>*</span></label>
          <select
            style={formStyles.select}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={submitting}
            required
          >
            <option value="">請選擇</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId}>{b.name}（{b.branchId}）</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>老師代碼</label>
            <input
              style={formStyles.input}
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              placeholder="例：T001"
              disabled={submitting}
            />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>教室</label>
            <input
              style={formStyles.input}
              value={classroom}
              onChange={(e) => setClassroom(e.target.value)}
              placeholder="例：301"
              disabled={submitting}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>上課日<span style={formStyles.required}>*</span></label>
            <select
              style={formStyles.select}
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
              disabled={submitting}
              required
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>{WEEKDAY_LABELS[d]}</option>
              ))}
            </select>
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>上課時間<span style={formStyles.required}>*</span></label>
            <input
              style={formStyles.input}
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>下課時間<span style={formStyles.required}>*</span></label>
            <input
              style={formStyles.input}
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={submitting}
              required
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
              啟用此班級（取消勾選等同停用，當日場次不會產生）
            </label>
          </div>
        )}

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
