// 課程單元新增 / 編輯表單

import { useEffect, useState, type FormEvent } from 'react';

import { Modal } from './Modal';
import { formStyles } from './formStyles';
import { createCourseModule, updateCourseModule } from '../services/courseModules';
import {
  COURSE_MODULES_COLLECTION,
  type CourseModuleDoc,
} from '../types/courseModule';
import { getNextId } from '../utils/autoId';

interface CourseModuleFormDialogProps {
  open: boolean;
  initial: CourseModuleDoc | null;
  courseId: string;
  branchId: string;
  defaultOrder?: number;
  onClose: () => void;
  onSaved: () => void;
}

export function CourseModuleFormDialog({
  open, initial, courseId, branchId, defaultOrder, onClose, onSaved,
}: CourseModuleFormDialogProps) {
  const isEdit = !!initial;
  const [moduleId, setModuleId] = useState('');
  const [name, setName] = useState('');
  const [plannedHours, setPlannedHours] = useState('');
  const [order, setOrder] = useState('0');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!initial) {
      getNextId('MOD', COURSE_MODULES_COLLECTION, 5).then(setModuleId).catch(() => {});
    } else {
      setModuleId(initial.moduleId);
    }
    setName(initial?.name ?? '');
    setPlannedHours(initial?.plannedHours ? String(initial.plannedHours) : '');
    setOrder(initial?.order != null ? String(initial.order) : String(defaultOrder ?? 0));
    setActive(initial?.active ?? true);
    setError(null);
  }, [open, initial, defaultOrder]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) return setError('請填寫單元名稱');
    const planned = plannedHours === '' ? 0 : Number(plannedHours);
    if (Number.isNaN(planned) || planned < 0) return setError('計畫時數請填寫正整數');
    const orderNum = order === '' ? 0 : Number(order);
    if (Number.isNaN(orderNum)) return setError('排序請填寫整數');
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && initial) {
        await updateCourseModule(initial.moduleId, {
          name, plannedHours: planned, order: orderNum, active,
        });
      } else {
        await createCourseModule({
          moduleId, courseId, branchId,
          name, plannedHours: planned, order: orderNum, active,
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
    <Modal open={open} title={isEdit ? '編輯課程單元' : '新增課程單元'} onClose={onClose} width={520}>
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
            <label style={formStyles.label}>計畫時數<span style={formStyles.required}>*</span></label>
            <input
              type="number" min={0} step={1}
              style={formStyles.input} value={plannedHours}
              onChange={(e) => setPlannedHours(e.target.value)}
              placeholder="40" disabled={submitting} required
            />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>排序</label>
            <input
              type="number" step={1}
              style={formStyles.input} value={order}
              onChange={(e) => setOrder(e.target.value)}
              placeholder="0" disabled={submitting}
            />
          </div>
        </div>

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
