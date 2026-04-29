// 課程方案場次新增 / 編輯表單
//
// hours 預設由 startTime / endTime 自動算（小時，2 位小數），允許手動覆寫。

import { useEffect, useState, type FormEvent } from 'react';

import { Modal } from './Modal';
import { formStyles } from './formStyles';
import { createCourseSession, updateCourseSession } from '../services/courseSessions';
import { subscribeInstructors } from '../services/instructors';
import {
  COURSE_SESSIONS_COLLECTION,
  computeHours,
  type CourseSessionDoc,
  type CourseSessionStatus,
} from '../types/courseSession';
import type { CourseModuleDoc } from '../types/courseModule';
import type { InstructorDoc } from '../types/instructor';
import { getNextId } from '../utils/autoId';

interface CourseSessionFormDialogProps {
  open: boolean;
  initial: CourseSessionDoc | null;
  courseId: string;
  branchId: string;
  modules: CourseModuleDoc[];
  defaults?: { instructorId?: string; classroom?: string };
  onClose: () => void;
  onSaved: () => void;
}

export function CourseSessionFormDialog({
  open, initial, courseId, branchId, modules, defaults, onClose, onSaved,
}: CourseSessionFormDialogProps) {
  const isEdit = !!initial;
  const [instructors, setInstructors] = useState<InstructorDoc[]>([]);

  const [courseSessionId, setCourseSessionId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [hours, setHours] = useState('3');
  const [hoursAuto, setHoursAuto] = useState(true);
  const [instructorId, setInstructorId] = useState('');
  const [classroom, setClassroom] = useState('');
  const [statusVal, setStatusVal] = useState<CourseSessionStatus>('scheduled');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeInstructors({ activeOnly: true }, setInstructors);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!initial) {
      getNextId('CS', COURSE_SESSIONS_COLLECTION, 6).then(setCourseSessionId).catch(() => {});
    } else {
      setCourseSessionId(initial.courseSessionId);
    }
    setModuleId(initial?.moduleId ?? (modules[0]?.moduleId ?? ''));
    setDate(initial?.date ?? new Date().toISOString().slice(0, 10));
    setStartTime(initial?.startTime ?? '09:00');
    setEndTime(initial?.endTime ?? '12:00');
    setHours(initial?.hours != null ? String(initial.hours) : '3');
    setHoursAuto(!isEdit); // 新增時預設自動，編輯時尊重原值
    setInstructorId(initial?.instructorId ?? defaults?.instructorId ?? '');
    setClassroom(initial?.classroom ?? defaults?.classroom ?? '');
    setStatusVal(initial?.status ?? 'scheduled');
    setNotes(initial?.notes ?? '');
    setError(null);
  }, [open, initial, modules, defaults, isEdit]);

  // 自動算時數
  useEffect(() => {
    if (!hoursAuto) return;
    const h = computeHours(startTime, endTime);
    setHours(String(h));
  }, [startTime, endTime, hoursAuto]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!date) return setError('請填寫日期');
    if (!startTime || !endTime) return setError('請填寫起訖時間');
    if (startTime >= endTime) return setError('下課時間必須晚於上課時間');
    const h = hours === '' ? 0 : Number(hours);
    if (Number.isNaN(h) || h < 0) return setError('時數請填寫正整數或小數');
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && initial) {
        await updateCourseSession(initial.courseSessionId, {
          moduleId, date, startTime, endTime, hours: h,
          instructorId, classroom, status: statusVal, notes,
        });
      } else {
        await createCourseSession({
          courseSessionId, courseId, moduleId, branchId,
          date, startTime, endTime, hours: h,
          instructorId, classroom, status: statusVal, notes,
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
    <Modal open={open} title={isEdit ? '編輯場次' : '新增場次'} onClose={onClose} width={620}>
      <form onSubmit={handleSubmit}>
        {error && <div style={formStyles.error}>{error}</div>}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: '0 0 170px' }}>
            <label style={formStyles.label}>場次代碼</label>
            <input
              style={{ ...formStyles.input, background: '#f9fafb' }}
              value={courseSessionId} readOnly disabled={submitting}
            />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>所屬單元</label>
            <select style={formStyles.select} value={moduleId}
              onChange={(e) => setModuleId(e.target.value)} disabled={submitting}>
              <option value="">（未指定）</option>
              {modules.map((m) => (
                <option key={m.moduleId} value={m.moduleId}>{m.name}（{m.moduleId}）</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>日期<span style={formStyles.required}>*</span></label>
            <input type="date" style={formStyles.input} value={date}
              onChange={(e) => setDate(e.target.value)} disabled={submitting} required />
          </div>
          <div style={{ ...formStyles.field, flex: '0 0 130px' }}>
            <label style={formStyles.label}>上課時間<span style={formStyles.required}>*</span></label>
            <input type="time" style={formStyles.input} value={startTime}
              onChange={(e) => setStartTime(e.target.value)} disabled={submitting} required />
          </div>
          <div style={{ ...formStyles.field, flex: '0 0 130px' }}>
            <label style={formStyles.label}>下課時間<span style={formStyles.required}>*</span></label>
            <input type="time" style={formStyles.input} value={endTime}
              onChange={(e) => setEndTime(e.target.value)} disabled={submitting} required />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: '0 0 180px' }}>
            <label style={formStyles.label}>實際時數<span style={formStyles.required}>*</span></label>
            <input
              type="number" min={0} step={0.25}
              style={formStyles.input} value={hours}
              onChange={(e) => { setHours(e.target.value); setHoursAuto(false); }}
              disabled={submitting} required
            />
            <span style={formStyles.hint}>
              {hoursAuto ? '依起訖時間自動計算' : '已手動調整'}
            </span>
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>狀態</label>
            <select style={formStyles.select} value={statusVal}
              onChange={(e) => setStatusVal(e.target.value as CourseSessionStatus)} disabled={submitting}>
              <option value="scheduled">待上課</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
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
        </div>

        <div style={formStyles.field}>
          <label style={formStyles.label}>備註</label>
          <textarea
            style={formStyles.textarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
          />
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
