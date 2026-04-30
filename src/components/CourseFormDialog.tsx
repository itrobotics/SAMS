// 學程新增 / 編輯表單

import { useEffect, useState, type FormEvent } from 'react';

import { Modal } from './Modal';
import { formStyles } from './formStyles';
import { useBranches } from '../hooks/useBranches';
import { createCourse, updateCourse } from '../services/courses';
import { subscribeInstructors } from '../services/instructors';
import {
  COURSES_COLLECTION,
  type CourseDoc,
  type CourseStatus,
} from '../types/course';
import type { InstructorDoc } from '../types/instructor';
import { getNextId } from '../utils/autoId';

interface CourseFormDialogProps {
  open: boolean;
  initial: CourseDoc | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CourseFormDialog({ open, initial, onClose, onSaved }: CourseFormDialogProps) {
  const isEdit = !!initial;
  const { branches } = useBranches(true);

  const [instructors, setInstructors] = useState<InstructorDoc[]>([]);

  const [courseId, setCourseId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [totalPlannedHours, setTotalPlannedHours] = useState('');
  const [defaultInstructorId, setDefaultInstructorId] = useState('');
  const [defaultClassroom, setDefaultClassroom] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<CourseStatus>('active');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeInstructors({ activeOnly: true }, setInstructors);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!initial) {
      getNextId('CRS', COURSES_COLLECTION, 5).then(setCourseId).catch(() => {});
    } else {
      setCourseId(initial.courseId);
    }
    setBranchId(initial?.branchId ?? '');
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setTotalPlannedHours(initial?.totalPlannedHours ? String(initial.totalPlannedHours) : '');
    setDefaultInstructorId(initial?.defaultInstructorId ?? '');
    setDefaultClassroom(initial?.defaultClassroom ?? '');
    setStartDate(initial?.startDate ?? '');
    setEndDate(initial?.endDate ?? '');
    setStatus(initial?.status ?? 'active');
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
    if (!branchId) return setError('請選擇分校');
    if (!name.trim()) return setError('請填寫課程名稱');
    const planned = totalPlannedHours === '' ? 0 : Number(totalPlannedHours);
    if (Number.isNaN(planned) || planned < 0) return setError('計畫總時數請填寫正整數');
    setSubmitting(true);
    setError(null);
    try {
      const common = {
        branchId,
        name,
        description,
        totalPlannedHours: planned,
        defaultInstructorId,
        defaultClassroom,
        startDate,
        endDate,
        status,
        active,
      };
      if (isEdit && initial) {
        await updateCourse(initial.courseId, common);
      } else {
        await createCourse({ courseId, ...common });
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
    <Modal open={open} title={isEdit ? '編輯學程' : '新增學程'} onClose={onClose} width={680}>
      <form onSubmit={handleSubmit}>
        {error && <div style={formStyles.error}>{error}</div>}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>課程代碼<span style={formStyles.required}>*</span></label>
            <input
              style={{ ...formStyles.input, background: '#f9fafb' }}
              value={courseId} readOnly placeholder="載入中…"
              disabled={submitting} required
            />
          </div>
          <div style={{ ...formStyles.field, flex: 2 }}>
            <label style={formStyles.label}>課程名稱<span style={formStyles.required}>*</span></label>
            <input
              style={formStyles.input} value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：400 小時 Python 全端職訓"
              disabled={submitting} required
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>分校<span style={formStyles.required}>*</span></label>
            <select style={formStyles.select} value={branchId}
              onChange={(e) => setBranchId(e.target.value)} disabled={submitting} required>
              <option value="">請選擇</option>
              {branches.map((b) => (
                <option key={b.branchId} value={b.branchId}>{b.name}（{b.branchId}）</option>
              ))}
            </select>
          </div>
          <div style={{ ...formStyles.field, flex: '0 0 160px' }}>
            <label style={formStyles.label}>計畫總時數<span style={formStyles.required}>*</span></label>
            <input
              type="number" min={0} step={1}
              style={formStyles.input} value={totalPlannedHours}
              onChange={(e) => setTotalPlannedHours(e.target.value)}
              placeholder="400" disabled={submitting} required
            />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>狀態</label>
            <select style={formStyles.select} value={status}
              onChange={(e) => setStatus(e.target.value as CourseStatus)} disabled={submitting}>
              <option value="active">進行中</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>開始日</label>
            <input type="date" style={formStyles.input} value={startDate}
              onChange={(e) => setStartDate(e.target.value)} disabled={submitting} />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>預計結束日</label>
            <input type="date" style={formStyles.input} value={endDate}
              onChange={(e) => setEndDate(e.target.value)} disabled={submitting} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>預設講師</label>
            <select style={formStyles.select} value={defaultInstructorId}
              onChange={(e) => setDefaultInstructorId(e.target.value)} disabled={submitting}>
              <option value="">（未指定）</option>
              {instructors.map((t) => (
                <option key={t.instructorId} value={t.instructorId}>
                  {t.instructorId}-{t.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>預設教室</label>
            <input
              style={formStyles.input} value={defaultClassroom}
              onChange={(e) => setDefaultClassroom(e.target.value)}
              placeholder="例：301" disabled={submitting}
            />
          </div>
        </div>

        <div style={formStyles.field}>
          <label style={formStyles.label}>課程說明</label>
          <textarea
            style={formStyles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="可填寫課程目標、適合對象、教材說明等"
            disabled={submitting}
          />
        </div>

        <div style={formStyles.field}>
          <label style={{ ...formStyles.label, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="checkbox" checked={active}
              onChange={(e) => setActive(e.target.checked)} disabled={submitting} />
            啟用此學程
          </label>
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
