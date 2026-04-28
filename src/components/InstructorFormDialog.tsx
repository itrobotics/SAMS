// 講師新增 / 編輯表單（Task 046）

import { useEffect, useState, type FormEvent } from 'react';

import { Modal } from './Modal';
import { formStyles } from './formStyles';
import { subscribeOptions } from '../services/appOptions';
import { createInstructor, updateInstructor } from '../services/instructors';
import { OPTION_KEYS } from '../types/appOptions';
import {
  SCHOOL_STATUS_LABELS,
  type InstructorDoc,
  type SchoolStatus,
} from '../types/instructor';

interface InstructorFormDialogProps {
  open: boolean;
  initial: InstructorDoc | null;
  onClose: () => void;
  onSaved: () => void;
}

const SCHOOL_STATUSES: SchoolStatus[] = ['graduated', 'dropped', 'enrolled'];

export function InstructorFormDialog({
  open,
  initial,
  onClose,
  onSaved,
}: InstructorFormDialogProps) {
  const isEdit = !!initial;

  const [courseOptions, setCourseOptions] = useState<string[]>([]);
  const [relationOptions, setRelationOptions] = useState<string[]>([]);

  const [instructorId, setInstructorId] = useState('');
  const [name, setName] = useState('');
  const [courses, setCourses] = useState<string[]>([]);
  const [education, setEducation] = useState('');
  const [schoolStatus, setSchoolStatus] = useState<SchoolStatus>('graduated');
  const [schoolName, setSchoolName] = useState('');
  const [department, setDepartment] = useState('');
  const [grade, setGrade] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [mailingAddress, setMailingAddress] = useState('');
  const [registeredSame, setRegisteredSame] = useState(true);
  const [registeredAddress, setRegisteredAddress] = useState('');
  const [ecName, setEcName] = useState('');
  const [ecRelation, setEcRelation] = useState('');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u1 = subscribeOptions(OPTION_KEYS.courses, setCourseOptions);
    const u2 = subscribeOptions(OPTION_KEYS.relationships, setRelationOptions);
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    if (!open) return;
    setInstructorId(initial?.instructorId ?? '');
    setName(initial?.name ?? '');
    setCourses(initial?.courses ?? []);
    setEducation(initial?.education ?? '');
    setSchoolStatus(initial?.schoolStatus ?? 'graduated');
    setSchoolName(initial?.schoolName ?? '');
    setDepartment(initial?.department ?? '');
    setGrade(initial?.grade ?? '');
    setPhone1(initial?.phone1 ?? '');
    setPhone2(initial?.phone2 ?? '');
    setMailingAddress(initial?.mailingAddress ?? '');
    setRegisteredSame(initial?.registeredAddressSameAsMailing ?? true);
    setRegisteredAddress(initial?.registeredAddress ?? '');
    setEcName(initial?.emergencyContactName ?? '');
    setEcRelation(initial?.emergencyContactRelation ?? '');
    setActive(initial?.active ?? true);
    setError(null);
  }, [open, initial]);

  function toggleCourse(c: string) {
    setCourses((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!instructorId.trim()) { setError('請填寫講師編號'); return; }
    if (!name.trim()) { setError('請填寫姓名'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        instructorId: instructorId.trim(),
        name: name.trim(),
        courses,
        education,
        schoolStatus,
        schoolName,
        department,
        grade: schoolStatus === 'enrolled' ? grade : '',
        phone1,
        phone2,
        mailingAddress,
        registeredAddressSameAsMailing: registeredSame,
        registeredAddress: registeredSame ? '' : registeredAddress,
        emergencyContactName: ecName,
        emergencyContactRelation: ecRelation,
        active,
      };
      if (isEdit && initial) {
        const { instructorId: _id, ...patch } = payload;
        await updateInstructor(initial.instructorId, patch);
      } else {
        await createInstructor(payload);
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
    <Modal open={open} title={isEdit ? '編輯講師' : '新增講師'} onClose={onClose} width={600}>
      <form onSubmit={handleSubmit}>
        {error && <div style={formStyles.error}>{error}</div>}

        {/* 基本資料 */}
        <div style={row2}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>
              講師編號<span style={formStyles.required}>*</span>
            </label>
            <input
              style={{ ...formStyles.input, background: isEdit ? '#f9fafb' : '#fff' }}
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              placeholder="例：T001"
              disabled={isEdit || submitting}
              required
            />
            {!isEdit && <span style={formStyles.hint}>建立後不可修改</span>}
          </div>
          <div style={{ ...formStyles.field, flex: 2 }}>
            <label style={formStyles.label}>
              姓名<span style={formStyles.required}>*</span>
            </label>
            <input
              style={formStyles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：陳老師"
              disabled={submitting}
              required
            />
          </div>
        </div>

        {/* 可教授課程 */}
        <div style={formStyles.field}>
          <label style={formStyles.label}>可教授課程</label>
          <div style={checkboxGroup}>
            {courseOptions.length === 0 && (
              <span style={formStyles.hint}>尚無課程選項，請先至「選項管理」新增</span>
            )}
            {courseOptions.map((c) => (
              <label key={c} style={checkboxLabel}>
                <input
                  type="checkbox"
                  checked={courses.includes(c)}
                  onChange={() => toggleCourse(c)}
                  disabled={submitting}
                />
                {c}
              </label>
            ))}
          </div>
        </div>

        {/* 學歷 */}
        <div style={sectionTitle}>學歷資訊</div>
        <div style={row2}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>最高學歷</label>
            <input
              style={formStyles.input}
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              placeholder="例：碩士"
              disabled={submitting}
            />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>就學狀態</label>
            <div style={{ display: 'flex', gap: '1rem', paddingTop: 6 }}>
              {SCHOOL_STATUSES.map((s) => (
                <label key={s} style={checkboxLabel}>
                  <input
                    type="radio"
                    name="schoolStatus"
                    value={s}
                    checked={schoolStatus === s}
                    onChange={() => setSchoolStatus(s)}
                    disabled={submitting}
                  />
                  {SCHOOL_STATUS_LABELS[s]}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div style={row3}>
          <div style={{ ...formStyles.field, flex: 2 }}>
            <label style={formStyles.label}>學校名稱</label>
            <input
              style={formStyles.input}
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="例：國立台灣大學"
              disabled={submitting}
            />
          </div>
          <div style={{ ...formStyles.field, flex: 2 }}>
            <label style={formStyles.label}>科系</label>
            <input
              style={formStyles.input}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="例：資訊工程學系"
              disabled={submitting}
            />
          </div>
          {schoolStatus === 'enrolled' && (
            <div style={{ ...formStyles.field, flex: 1 }}>
              <label style={formStyles.label}>年級</label>
              <input
                style={formStyles.input}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="例：大三"
                disabled={submitting}
              />
            </div>
          )}
        </div>

        {/* 聯絡資訊 */}
        <div style={sectionTitle}>聯絡資訊</div>
        <div style={row2}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>聯絡電話1</label>
            <input style={formStyles.input} type="tel" value={phone1}
              onChange={(e) => setPhone1(e.target.value)} placeholder="09xxxxxxxx" disabled={submitting} />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>聯絡電話2</label>
            <input style={formStyles.input} type="tel" value={phone2}
              onChange={(e) => setPhone2(e.target.value)} placeholder="09xxxxxxxx" disabled={submitting} />
          </div>
        </div>
        <div style={formStyles.field}>
          <label style={formStyles.label}>通訊地址</label>
          <input style={formStyles.input} value={mailingAddress}
            onChange={(e) => setMailingAddress(e.target.value)} placeholder="縣市鄉鎮路街號" disabled={submitting} />
        </div>
        <div style={formStyles.field}>
          <label style={{ ...formStyles.label, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={registeredSame}
              onChange={(e) => setRegisteredSame(e.target.checked)}
              disabled={submitting}
            />
            戶籍地址同通訊地址
          </label>
        </div>
        {!registeredSame && (
          <div style={formStyles.field}>
            <label style={formStyles.label}>戶籍地址</label>
            <input style={formStyles.input} value={registeredAddress}
              onChange={(e) => setRegisteredAddress(e.target.value)} placeholder="縣市鄉鎮路街號" disabled={submitting} />
          </div>
        )}

        {/* 緊急聯絡人 */}
        <div style={sectionTitle}>緊急聯絡人</div>
        <div style={row2}>
          <div style={{ ...formStyles.field, flex: 2 }}>
            <label style={formStyles.label}>姓名</label>
            <input style={formStyles.input} value={ecName}
              onChange={(e) => setEcName(e.target.value)} placeholder="例：陳媽媽" disabled={submitting} />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>關係</label>
            <select style={formStyles.select} value={ecRelation}
              onChange={(e) => setEcRelation(e.target.value)} disabled={submitting}>
              <option value="">請選擇</option>
              {relationOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {isEdit && (
          <div style={formStyles.field}>
            <label style={{ ...formStyles.label, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="checkbox" checked={active}
                onChange={(e) => setActive(e.target.checked)} disabled={submitting} />
              啟用此講師（取消勾選等同停用）
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

const row2: React.CSSProperties = { display: 'flex', gap: '0.75rem' };
const row3: React.CSSProperties = { display: 'flex', gap: '0.75rem' };
const sectionTitle: React.CSSProperties = {
  fontSize: '0.8rem', fontWeight: 600, color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid #e5e7eb', paddingBottom: '0.3rem', marginBottom: '0.75rem',
};
const checkboxGroup: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', paddingTop: 4,
};
const checkboxLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.3rem',
  fontSize: '0.9rem', cursor: 'pointer',
};
