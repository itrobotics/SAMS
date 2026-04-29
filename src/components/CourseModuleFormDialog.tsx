// 課程單元新增 / 編輯表單
//
// 設計要點：
//   - 講師 / 教室為單一欄位（不分「預設/覆蓋」），刻意比班級的兩層設計簡單
//   - 上課時段以多筆 slot 列表呈現；每筆 = 日期 / 起 / 訖 / 時數
//   - 時數預設由起訖自動算（手動修改後維持手動值）
//   - 計畫時數 = slots 加總，不另存欄位（顯示在小計）

import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Modal } from './Modal';
import { formStyles } from './formStyles';
import { createCourseModule, updateCourseModule } from '../services/courseModules';
import { subscribeInstructors } from '../services/instructors';
import {
  COURSE_MODULES_COLLECTION,
  sumSlotHours,
  type CourseModuleDoc,
  type CourseModuleSlot,
} from '../types/courseModule';
import { computeHours } from '../types/courseSession';
import type { InstructorDoc } from '../types/instructor';
import { getNextId } from '../utils/autoId';

interface CourseModuleFormDialogProps {
  open: boolean;
  initial: CourseModuleDoc | null;
  courseId: string;
  branchId: string;
  defaultOrder?: number;
  defaults?: { instructorId?: string; classroom?: string };
  onClose: () => void;
  onSaved: () => void;
}

interface SlotRow extends CourseModuleSlot {
  // 內部 UI 狀態：是否曾被使用者手動改過 hours（之後不再 auto sync）
  hoursManual: boolean;
}

function emptySlotRow(): SlotRow {
  return {
    date: new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    endTime: '12:00',
    hours: computeHours('09:00', '12:00'),
    hoursManual: false,
  };
}

export function CourseModuleFormDialog({
  open, initial, courseId, branchId, defaultOrder, defaults, onClose, onSaved,
}: CourseModuleFormDialogProps) {
  const isEdit = !!initial;
  const [instructors, setInstructors] = useState<InstructorDoc[]>([]);

  const [moduleId, setModuleId] = useState('');
  const [name, setName] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [classroom, setClassroom] = useState('');
  const [order, setOrder] = useState('0');
  const [active, setActive] = useState(true);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeInstructors({ activeOnly: true }, setInstructors);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!initial) {
      getNextId('MOD', COURSE_MODULES_COLLECTION, 5).then(setModuleId).catch(() => {});
    } else {
      setModuleId(initial.moduleId);
    }
    setName(initial?.name ?? '');
    setInstructorId(initial?.instructorId ?? defaults?.instructorId ?? '');
    setClassroom(initial?.classroom ?? defaults?.classroom ?? '');
    setOrder(initial?.order != null ? String(initial.order) : String(defaultOrder ?? 0));
    setActive(initial?.active ?? true);
    setSlots(
      initial?.slots && initial.slots.length > 0
        // 編輯既有 slot：尊重原本的 hours，標 manual 以免覆寫
        ? initial.slots.map((s) => ({ ...s, hoursManual: true }))
        : [],
    );
    setError(null);
  }, [open, initial, defaultOrder, defaults]);

  const totalHours = useMemo(() => sumSlotHours(slots), [slots]);

  function addSlot() {
    setSlots((prev) => {
      const last = prev[prev.length - 1];
      // 沿用上一筆的日期 + 時間（方便連續多日複製），但 hoursManual=false 重新自動算
      const next: SlotRow = last
        ? { ...last, hoursManual: false, hours: computeHours(last.startTime, last.endTime) }
        : emptySlotRow();
      return [...prev, next];
    });
  }

  function removeSlot(index: number) {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSlot(index: number, patch: Partial<SlotRow>) {
    setSlots((prev) => prev.map((s, i) => {
      if (i !== index) return s;
      const merged = { ...s, ...patch };
      // 若 user 改 hours，標 manual；否則 hours 跟著起訖自動算
      if (patch.hours !== undefined) {
        merged.hoursManual = true;
      } else if (patch.startTime !== undefined || patch.endTime !== undefined) {
        if (!merged.hoursManual) {
          merged.hours = computeHours(merged.startTime, merged.endTime);
        }
      }
      return merged;
    }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) return setError('請填寫單元名稱');
    const orderNum = order === '' ? 0 : Number(order);
    if (Number.isNaN(orderNum)) return setError('排序請填寫整數');
    setSubmitting(true);
    setError(null);
    try {
      // 把 SlotRow 還原為 CourseModuleSlot（去掉 hoursManual）
      const cleanSlots: CourseModuleSlot[] = slots.map((s) => ({
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        hours: Number(s.hours) || 0,
      }));
      if (isEdit && initial) {
        await updateCourseModule(initial.moduleId, {
          name, instructorId, classroom, slots: cleanSlots, order: orderNum, active,
        });
      } else {
        await createCourseModule({
          moduleId, courseId, branchId,
          name, instructorId, classroom, slots: cleanSlots, order: orderNum, active,
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
    <Modal open={open} title={isEdit ? '編輯課程單元' : '新增課程單元'} onClose={onClose} width={760}>
      <form onSubmit={handleSubmit}>
        {error && <div style={formStyles.error}>{error}</div>}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: '0 0 160px' }}>
            <label style={formStyles.label}>單元代碼</label>
            <input
              style={{ ...formStyles.input, background: '#f9fafb' }}
              value={moduleId} readOnly placeholder="載入中…" disabled={submitting}
            />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>單元名稱<span style={formStyles.required}>*</span></label>
            <input
              style={formStyles.input} value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：Python 基礎"
              disabled={submitting} required
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>講師</label>
            <select style={formStyles.select} value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)} disabled={submitting}>
              <option value="">（未指定）</option>
              {instructors.map((t) => (
                <option key={t.instructorId} value={t.instructorId}>
                  {t.instructorId}-{t.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>教室</label>
            <input
              style={formStyles.input} value={classroom}
              onChange={(e) => setClassroom(e.target.value)}
              placeholder="例：301" disabled={submitting}
            />
          </div>
          <div style={{ ...formStyles.field, flex: '0 0 100px' }}>
            <label style={formStyles.label}>排序</label>
            <input
              type="number" step={1}
              style={formStyles.input} value={order}
              onChange={(e) => setOrder(e.target.value)}
              placeholder="0" disabled={submitting}
            />
          </div>
        </div>

        {/* 上課時段 */}
        <fieldset style={slotsBoxStyle}>
          <legend style={legendStyle}>上課時段</legend>
          <p style={{ ...formStyles.hint, margin: '0 0 0.5rem' }}>
            可填多筆；時數預設由起訖時間自動算，手動修改後不再覆寫。儲存後會以單元代碼-序號顯示（MOD00001-1, -2, …）。
          </p>

          {slots.length === 0 ? (
            <p style={{ ...formStyles.hint, fontStyle: 'italic', margin: '0.5rem 0' }}>
              還沒有時段。點下方按鈕新增。
            </p>
          ) : (
            <table style={slotTableStyle}>
              <thead>
                <tr>
                  <th style={slotThStyle}>序</th>
                  <th style={slotThStyle}>日期</th>
                  <th style={slotThStyle}>開始</th>
                  <th style={slotThStyle}>結束</th>
                  <th style={{ ...slotThStyle, textAlign: 'right' }}>時數</th>
                  <th style={slotThStyle}></th>
                </tr>
              </thead>
              <tbody>
                {slots.map((s, idx) => (
                  <tr key={idx}>
                    <td style={{ ...slotTdStyle, color: '#6b7280', fontSize: '0.85rem' }}>
                      {moduleId ? `${moduleId}-${idx + 1}` : `${idx + 1}`}
                    </td>
                    <td style={slotTdStyle}>
                      <input
                        type="date" style={slotInputStyle}
                        value={s.date}
                        onChange={(e) => updateSlot(idx, { date: e.target.value })}
                        disabled={submitting} required
                      />
                    </td>
                    <td style={slotTdStyle}>
                      <input
                        type="time" style={slotInputStyle}
                        value={s.startTime}
                        onChange={(e) => updateSlot(idx, { startTime: e.target.value })}
                        disabled={submitting} required
                      />
                    </td>
                    <td style={slotTdStyle}>
                      <input
                        type="time" style={slotInputStyle}
                        value={s.endTime}
                        onChange={(e) => updateSlot(idx, { endTime: e.target.value })}
                        disabled={submitting} required
                      />
                    </td>
                    <td style={{ ...slotTdStyle, textAlign: 'right' }}>
                      <input
                        type="number" min={0} step={0.25}
                        style={{ ...slotInputStyle, width: 70, textAlign: 'right' }}
                        value={s.hours}
                        onChange={(e) => updateSlot(idx, { hours: Number(e.target.value) })}
                        disabled={submitting}
                      />
                    </td>
                    <td style={{ ...slotTdStyle, textAlign: 'center' }}>
                      <button
                        type="button" onClick={() => removeSlot(idx)}
                        disabled={submitting}
                        style={slotRemoveBtnStyle}
                        aria-label={`刪除第 ${idx + 1} 列`}
                        title="刪除此列"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} style={{ ...slotTdStyle, textAlign: 'right', fontWeight: 600 }}>
                    小計
                  </td>
                  <td style={{ ...slotTdStyle, textAlign: 'right', fontWeight: 600 }}>
                    {totalHours} h
                  </td>
                  <td style={slotTdStyle}></td>
                </tr>
              </tbody>
            </table>
          )}

          <button type="button" onClick={addSlot} disabled={submitting} style={addSlotBtnStyle}>
            ＋ 新增時段
          </button>
        </fieldset>

        <div style={formStyles.field}>
          <label style={{ ...formStyles.label, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="checkbox" checked={active}
              onChange={(e) => setActive(e.target.checked)} disabled={submitting} />
            啟用此單元
          </label>
        </div>

        <div style={formStyles.actions}>
          <button type="button" style={formStyles.btnSecondary} onClick={onClose} disabled={submitting}>取消</button>
          <button type="submit" style={formStyles.btnPrimary} disabled={submitting}>
            {submitting ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const slotsBoxStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb', borderRadius: 8,
  padding: '0.75rem 1rem 1rem', margin: '0 0 0.9rem',
};
const legendStyle: React.CSSProperties = {
  padding: '0 0.4rem', fontSize: '0.85rem', color: '#374151', fontWeight: 500,
};
const slotTableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem',
  marginBottom: '0.5rem',
};
const slotThStyle: React.CSSProperties = {
  textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: '1px solid #e5e7eb',
  background: '#f9fafb', fontWeight: 600, fontSize: '0.8rem', color: '#6b7280',
};
const slotTdStyle: React.CSSProperties = {
  padding: '0.35rem 0.5rem', borderBottom: '1px solid #f3f4f6',
};
const slotInputStyle: React.CSSProperties = {
  padding: '0.35rem 0.5rem', fontSize: '0.9rem',
  border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', outline: 'none',
};
const slotRemoveBtnStyle: React.CSSProperties = {
  padding: '0.25rem 0.45rem',
  background: '#fff', color: '#b91c1c', border: '1px solid #fecaca',
  borderRadius: 6, fontSize: '0.85rem', lineHeight: 1, cursor: 'pointer',
};
const addSlotBtnStyle: React.CSSProperties = {
  marginTop: '0.25rem', padding: '0.45rem 0.85rem',
  background: '#fff', color: '#2563eb', border: '1px dashed #93c5fd',
  borderRadius: 6, fontSize: '0.9rem',
};
