// 班級新增 / 編輯表單（多時段版）
//
// 一個班級可有多組 meetings，每組指定 weekday + 時段，並可選擇性 override
// 教室 / 老師。同一 weekday 可有多筆（如週一 AM / 週一 PM 不同老師），
// 但時段不可重疊。

import { useEffect, useState, type FormEvent } from 'react';

import { Modal } from './Modal';
import { formStyles } from './formStyles';
import { useBranches } from '../hooks/useBranches';
import { createClass, updateClass } from '../services/classes';
import {
  CLASSES_COLLECTION,
  WEEKDAY_LABELS,
  isValidClassId,
  type ClassDoc,
  type ClassMeeting,
} from '../types/class';
import { getNextId } from '../utils/autoId';

interface ClassFormDialogProps {
  open: boolean;
  initial: ClassDoc | null;
  onClose: () => void;
  onSaved: () => void;
}

const DEFAULT_MEETING: ClassMeeting = { weekday: 1, startTime: '17:00', endTime: '18:30' };

export function ClassFormDialog({ open, initial, onClose, onSaved }: ClassFormDialogProps) {
  const isEdit = !!initial;
  const { branches } = useBranches(true);

  const [classId, setClassId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [name, setName] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [classroom, setClassroom] = useState('');
  const [meetings, setMeetings] = useState<ClassMeeting[]>([DEFAULT_MEETING]);
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!initial) {
      getNextId('C', CLASSES_COLLECTION).then(setClassId).catch(() => {});
    } else {
      setClassId(initial.classId);
    }
    setBranchId(initial?.branchId ?? '');
    setName(initial?.name ?? '');
    setTeacherId(initial?.teacherId ?? '');
    setClassroom(initial?.classroom ?? '');
    setMeetings(
      initial?.meetings && initial.meetings.length > 0
        ? initial.meetings.map((m) => ({ ...m }))
        : [{ ...DEFAULT_MEETING }],
    );
    setActive(initial?.active ?? true);
    setError(null);
  }, [open, initial]);

  useEffect(() => {
    if (!open || isEdit) return;
    if (!branchId && branches.length === 1) setBranchId(branches[0].branchId);
  }, [open, isEdit, branchId, branches]);

  function updateMeeting(index: number, patch: Partial<ClassMeeting>) {
    setMeetings((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function addMeeting() {
    // 複製最後一筆當 template；user 通常只改 weekday 或時段
    setMeetings((prev) => {
      const last = prev[prev.length - 1] ?? DEFAULT_MEETING;
      return [...prev, { ...last, classroom: undefined, teacherId: undefined }];
    });
  }

  function removeMeeting(index: number) {
    setMeetings((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

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
      // meetings 的詳細驗證（重疊、格式）由 service 端 validateMeetings 處理，
      // 這邊只做粗略 UI guard
      if (isEdit && initial) {
        await updateClass(initial.classId, {
          branchId, name, teacherId, classroom, meetings, active,
        });
      } else {
        await createClass({
          classId, branchId, name, teacherId, classroom, meetings,
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
    <Modal open={open} title={isEdit ? '編輯班級' : '新增班級'} onClose={onClose} width={680}>
      <form onSubmit={handleSubmit}>
        {error && <div style={formStyles.error}>{error}</div>}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>班級代碼<span style={formStyles.required}>*</span></label>
            <input
              style={{ ...formStyles.input, background: '#f9fafb' }}
              value={classId}
              readOnly
              placeholder="載入中…"
              disabled={submitting}
              required
            />
          </div>
          <div style={{ ...formStyles.field, flex: 2 }}>
            <label style={formStyles.label}>班級名稱<span style={formStyles.required}>*</span></label>
            <input
              style={formStyles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：Scratch 全期班"
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
            <label style={formStyles.label}>預設老師代碼</label>
            <input
              style={formStyles.input}
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              placeholder="例：T001"
              disabled={submitting}
            />
            <span style={formStyles.hint}>個別時段可在下方覆蓋</span>
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>預設教室</label>
            <input
              style={formStyles.input}
              value={classroom}
              onChange={(e) => setClassroom(e.target.value)}
              placeholder="例：301"
              disabled={submitting}
            />
            <span style={formStyles.hint}>個別時段可在下方覆蓋</span>
          </div>
        </div>

        <fieldset style={meetingsBoxStyle}>
          <legend style={legendStyle}>
            上課時段<span style={formStyles.required}>*</span>
          </legend>
          <p style={{ ...formStyles.hint, margin: '0 0 0.5rem' }}>
            可設定多組時段；同一上課日可分成早/晚（不可重疊）。教室或老師留白即沿用上方預設。
          </p>
          {meetings.map((m, idx) => (
            <MeetingRow
              key={idx}
              meeting={m}
              canDelete={meetings.length > 1}
              disabled={submitting}
              onChange={(patch) => updateMeeting(idx, patch)}
              onRemove={() => removeMeeting(idx)}
            />
          ))}
          <button
            type="button"
            onClick={addMeeting}
            disabled={submitting}
            style={addMeetingBtnStyle}
          >
            ＋ 新增上課時段
          </button>
        </fieldset>

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

interface MeetingRowProps {
  meeting: ClassMeeting;
  canDelete: boolean;
  disabled: boolean;
  onChange: (patch: Partial<ClassMeeting>) => void;
  onRemove: () => void;
}

function MeetingRow({ meeting, canDelete, disabled, onChange, onRemove }: MeetingRowProps) {
  return (
    <div style={meetingRowStyle}>
      <div style={meetingRowMainStyle}>
        <select
          aria-label="上課日"
          style={{ ...formStyles.select, flex: '0 0 90px' }}
          value={meeting.weekday}
          onChange={(e) => onChange({ weekday: Number(e.target.value) })}
          disabled={disabled}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <option key={d} value={d}>{WEEKDAY_LABELS[d]}</option>
          ))}
        </select>
        <input
          aria-label="上課時間"
          type="time"
          style={{ ...formStyles.input, flex: '0 0 110px' }}
          value={meeting.startTime}
          onChange={(e) => onChange({ startTime: e.target.value })}
          disabled={disabled}
          required
        />
        <span style={{ color: '#6b7280' }}>–</span>
        <input
          aria-label="下課時間"
          type="time"
          style={{ ...formStyles.input, flex: '0 0 110px' }}
          value={meeting.endTime}
          onChange={(e) => onChange({ endTime: e.target.value })}
          disabled={disabled}
          required
        />
        {canDelete && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            style={meetingRemoveBtnStyle}
            aria-label="刪除此時段"
            title="刪除此時段"
          >
            ✕
          </button>
        )}
      </div>
      <div style={meetingRowOverrideStyle}>
        <input
          aria-label="教室（可空）"
          style={{ ...formStyles.input, flex: 1 }}
          value={meeting.classroom ?? ''}
          onChange={(e) => onChange({ classroom: e.target.value || undefined })}
          placeholder="教室（沿用預設）"
          disabled={disabled}
        />
        <input
          aria-label="老師（可空）"
          style={{ ...formStyles.input, flex: 1 }}
          value={meeting.teacherId ?? ''}
          onChange={(e) => onChange({ teacherId: e.target.value || undefined })}
          placeholder="老師代碼（沿用預設）"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

const meetingsBoxStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '0.75rem 1rem 1rem',
  margin: '0 0 0.9rem',
};
const legendStyle: React.CSSProperties = {
  padding: '0 0.4rem',
  fontSize: '0.85rem',
  color: '#374151',
  fontWeight: 500,
};
const meetingRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  padding: '0.5rem 0',
  borderBottom: '1px dashed #f3f4f6',
};
const meetingRowMainStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
  alignItems: 'center',
};
const meetingRowOverrideStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
};
const meetingRemoveBtnStyle: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '0.35rem 0.6rem',
  background: '#fff',
  color: '#b91c1c',
  border: '1px solid #fecaca',
  borderRadius: 6,
  fontSize: '0.85rem',
  lineHeight: 1,
};
const addMeetingBtnStyle: React.CSSProperties = {
  marginTop: '0.5rem',
  padding: '0.45rem 0.85rem',
  background: '#fff',
  color: '#2563eb',
  border: '1px dashed #93c5fd',
  borderRadius: 6,
  fontSize: '0.9rem',
};
