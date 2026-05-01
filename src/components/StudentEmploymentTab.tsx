// 學生詳情頁「就業追蹤」Tab
//
// 三個區塊：
//   1. 證照紀錄 — 列表 + 新增 Dialog
//   2. 就業狀態歷程 — 時間序列表，最新突顯
//   3. 輔導紀錄時間軸 — 依 contactAt 排列

import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';

import {
  addCertification,
  addCoachingRecord,
  addEmploymentStatus,
  deleteCertification,
  deleteCoachingRecord,
  deleteEmploymentStatus,
  subscribeCertifications,
  subscribeCoachingRecords,
  subscribeEmploymentStatuses,
} from '../services/employmentTracking';
import {
  CONTACT_METHOD_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  RELATED_TO_TRAINING_LABELS,
  SALARY_RANGE_LABELS,
  type CertificationRecord,
  type CoachingRecord,
  type ContactMethod,
  type EmploymentStatus,
  type EmploymentStatusType,
  type RelatedToTraining,
  type SalaryRange,
} from '../types/employmentTracking';
import type { ClassStudentDoc } from '../types/classStudent';

interface Props {
  studentId: string;
  enrollments: ClassStudentDoc[];
}

const today = new Date().toISOString().slice(0, 10);

function formatTs(ts: Timestamp | undefined | null): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Add Cert Dialog ──────────────────────────────────────────────────────────

interface AddCertFormState {
  courseId: string;
  certName: string;
  examDate: string;
  passed: boolean;
  notes: string;
}

function AddCertDialog({
  studentId,
  enrollments,
  onClose,
}: {
  studentId: string;
  enrollments: ClassStudentDoc[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<AddCertFormState>({
    courseId: enrollments[0]?.classId ?? '',
    certName: '',
    examDate: today,
    passed: true,
    notes: '',
  });
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!form.courseId) return window.alert('請選擇班級');
    if (!form.certName.trim()) return window.alert('請填寫證照名稱');
    if (!form.examDate) return window.alert('請填寫考試日期');
    setBusy(true);
    try {
      await addCertification({
        studentId,
        courseId: form.courseId,
        certName: form.certName.trim(),
        examDate: form.examDate,
        passed: form.passed,
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      onClose();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitleStyle}>新增證照紀錄</h3>
        <div style={formGridStyle}>
          <label style={labelStyle}>班級</label>
          <select
            style={inputStyle}
            value={form.courseId}
            onChange={(e) => setForm({ ...form, courseId: e.target.value })}
          >
            {enrollments.filter((e) => e.active).map((e) => (
              <option key={e.id} value={e.classId}>{e.classId}</option>
            ))}
            {enrollments.filter((e) => e.active).length === 0 && (
              <option value="">（無在讀班級）</option>
            )}
          </select>

          <label style={labelStyle}>證照名稱</label>
          <input
            style={inputStyle}
            value={form.certName}
            onChange={(e) => setForm({ ...form, certName: e.target.value })}
            placeholder="例：乙級技術士"
          />

          <label style={labelStyle}>考試日期</label>
          <input
            type="date"
            style={inputStyle}
            value={form.examDate}
            onChange={(e) => setForm({ ...form, examDate: e.target.value })}
          />

          <label style={labelStyle}>結果</label>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {(['通過', '未通過'] as const).map((label, i) => (
              <label key={label} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={form.passed === (i === 0)}
                  onChange={() => setForm({ ...form, passed: i === 0 })}
                />
                {label}
              </label>
            ))}
          </div>

          <label style={labelStyle}>備註</label>
          <input
            style={inputStyle}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="選填"
          />
        </div>
        <div style={modalActionsStyle}>
          <button style={cancelBtnStyle} onClick={onClose} disabled={busy}>取消</button>
          <button style={saveBtnStyle} onClick={handleSubmit} disabled={busy}>
            {busy ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Employment Dialog ─────────────────────────────────────────────────────

interface AddEmpFormState {
  courseId: string;
  trackedAt: string;
  status: EmploymentStatusType;
  company: string;
  jobTitle: string;
  salaryRange: SalaryRange | '';
  relatedToTraining: RelatedToTraining | '';
}

function AddEmploymentDialog({
  studentId,
  enrollments,
  onClose,
}: {
  studentId: string;
  enrollments: ClassStudentDoc[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<AddEmpFormState>({
    courseId: enrollments[0]?.classId ?? '',
    trackedAt: today,
    status: 'employed',
    company: '',
    jobTitle: '',
    salaryRange: '',
    relatedToTraining: '',
  });
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!form.courseId) return window.alert('請選擇班級');
    if (!form.trackedAt) return window.alert('請填寫追蹤日期');
    setBusy(true);
    try {
      await addEmploymentStatus({
        studentId,
        courseId: form.courseId,
        trackedAt: form.trackedAt,
        status: form.status,
        ...(form.company.trim() ? { company: form.company.trim() } : {}),
        ...(form.jobTitle.trim() ? { jobTitle: form.jobTitle.trim() } : {}),
        ...(form.salaryRange ? { salaryRange: form.salaryRange } : {}),
        ...(form.relatedToTraining ? { relatedToTraining: form.relatedToTraining } : {}),
      });
      onClose();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitleStyle}>新增就業狀態</h3>
        <div style={formGridStyle}>
          <label style={labelStyle}>班級</label>
          <select
            style={inputStyle}
            value={form.courseId}
            onChange={(e) => setForm({ ...form, courseId: e.target.value })}
          >
            {enrollments.filter((e) => e.active).map((e) => (
              <option key={e.id} value={e.classId}>{e.classId}</option>
            ))}
          </select>

          <label style={labelStyle}>追蹤日期</label>
          <input
            type="date"
            style={inputStyle}
            value={form.trackedAt}
            onChange={(e) => setForm({ ...form, trackedAt: e.target.value })}
          />

          <label style={labelStyle}>就業狀態</label>
          <select
            style={inputStyle}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as EmploymentStatusType })}
          >
            {(Object.entries(EMPLOYMENT_STATUS_LABELS) as [EmploymentStatusType, string][]).map(
              ([v, l]) => <option key={v} value={v}>{l}</option>
            )}
          </select>

          <label style={labelStyle}>任職公司</label>
          <input
            style={inputStyle}
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            placeholder="選填"
          />

          <label style={labelStyle}>職務名稱</label>
          <input
            style={inputStyle}
            value={form.jobTitle}
            onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            placeholder="選填"
          />

          <label style={labelStyle}>薪資區間</label>
          <select
            style={inputStyle}
            value={form.salaryRange}
            onChange={(e) => setForm({ ...form, salaryRange: e.target.value as SalaryRange | '' })}
          >
            <option value="">— 不填 —</option>
            {(Object.entries(SALARY_RANGE_LABELS) as [SalaryRange, string][]).map(
              ([v, l]) => <option key={v} value={v}>{l}</option>
            )}
          </select>

          <label style={labelStyle}>與訓練相關</label>
          <select
            style={inputStyle}
            value={form.relatedToTraining}
            onChange={(e) => setForm({ ...form, relatedToTraining: e.target.value as RelatedToTraining | '' })}
          >
            <option value="">— 不填 —</option>
            {(Object.entries(RELATED_TO_TRAINING_LABELS) as [RelatedToTraining, string][]).map(
              ([v, l]) => <option key={v} value={v}>{l}</option>
            )}
          </select>
        </div>
        <div style={modalActionsStyle}>
          <button style={cancelBtnStyle} onClick={onClose} disabled={busy}>取消</button>
          <button style={saveBtnStyle} onClick={handleSubmit} disabled={busy}>
            {busy ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Coaching Dialog ──────────────────────────────────────────────────────

interface AddCoachFormState {
  courseId: string;
  contactDate: string;
  contactTime: string;
  counselorName: string;
  contactMethod: ContactMethod;
  content: string;
  nextContactDate: string;
}

function AddCoachingDialog({
  studentId,
  enrollments,
  onClose,
}: {
  studentId: string;
  enrollments: ClassStudentDoc[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<AddCoachFormState>({
    courseId: enrollments[0]?.classId ?? '',
    contactDate: today,
    contactTime: '09:00',
    counselorName: '',
    contactMethod: 'phone',
    content: '',
    nextContactDate: '',
  });
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!form.courseId) return window.alert('請選擇班級');
    if (!form.counselorName.trim()) return window.alert('請填寫輔導員姓名');
    if (!form.content.trim()) return window.alert('請填寫紀錄內容');
    setBusy(true);
    try {
      const contactAt = Timestamp.fromDate(
        new Date(`${form.contactDate}T${form.contactTime}:00`),
      );
      await addCoachingRecord({
        studentId,
        courseId: form.courseId,
        contactAt,
        counselorName: form.counselorName.trim(),
        contactMethod: form.contactMethod,
        content: form.content.trim(),
        ...(form.nextContactDate ? { nextContactDate: form.nextContactDate } : {}),
      });
      onClose();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitleStyle}>新增輔導紀錄</h3>
        <div style={formGridStyle}>
          <label style={labelStyle}>班級</label>
          <select
            style={inputStyle}
            value={form.courseId}
            onChange={(e) => setForm({ ...form, courseId: e.target.value })}
          >
            {enrollments.filter((e) => e.active).map((e) => (
              <option key={e.id} value={e.classId}>{e.classId}</option>
            ))}
          </select>

          <label style={labelStyle}>聯絡日期</label>
          <input
            type="date"
            style={inputStyle}
            value={form.contactDate}
            onChange={(e) => setForm({ ...form, contactDate: e.target.value })}
          />

          <label style={labelStyle}>聯絡時間</label>
          <input
            type="time"
            style={inputStyle}
            value={form.contactTime}
            onChange={(e) => setForm({ ...form, contactTime: e.target.value })}
          />

          <label style={labelStyle}>輔導員</label>
          <input
            style={inputStyle}
            value={form.counselorName}
            onChange={(e) => setForm({ ...form, counselorName: e.target.value })}
            placeholder="輔導員姓名"
          />

          <label style={labelStyle}>聯絡方式</label>
          <select
            style={inputStyle}
            value={form.contactMethod}
            onChange={(e) => setForm({ ...form, contactMethod: e.target.value as ContactMethod })}
          >
            {(Object.entries(CONTACT_METHOD_LABELS) as [ContactMethod, string][]).map(
              ([v, l]) => <option key={v} value={v}>{l}</option>
            )}
          </select>

          <label style={labelStyle}>紀錄內容</label>
          <textarea
            style={{ ...inputStyle, height: 80, resize: 'vertical' }}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="聯絡情況、學員狀態等"
          />

          <label style={labelStyle}>下次追蹤日</label>
          <input
            type="date"
            style={inputStyle}
            value={form.nextContactDate}
            onChange={(e) => setForm({ ...form, nextContactDate: e.target.value })}
          />
        </div>
        <div style={modalActionsStyle}>
          <button style={cancelBtnStyle} onClick={onClose} disabled={busy}>取消</button>
          <button style={saveBtnStyle} onClick={handleSubmit} disabled={busy}>
            {busy ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Tab Component ───────────────────────────────────────────────────────

export function StudentEmploymentTab({ studentId, enrollments }: Props) {
  const [certifications, setCertifications] = useState<CertificationRecord[]>([]);
  const [employmentStatuses, setEmploymentStatuses] = useState<EmploymentStatus[]>([]);
  const [coachingRecords, setCoachingRecords] = useState<CoachingRecord[]>([]);

  const [addCertOpen, setAddCertOpen] = useState(false);
  const [addEmpOpen, setAddEmpOpen] = useState(false);
  const [addCoachOpen, setAddCoachOpen] = useState(false);

  useEffect(() => subscribeCertifications(studentId, setCertifications), [studentId]);
  useEffect(() => subscribeEmploymentStatuses(studentId, setEmploymentStatuses), [studentId]);
  useEffect(() => subscribeCoachingRecords(studentId, setCoachingRecords), [studentId]);

  async function handleDeleteCert(id: string) {
    if (!window.confirm('確定刪除此證照紀錄？')) return;
    try {
      await deleteCertification(id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '刪除失敗');
    }
  }

  async function handleDeleteEmp(id: string) {
    if (!window.confirm('確定刪除此就業狀態紀錄？')) return;
    try {
      await deleteEmploymentStatus(id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '刪除失敗');
    }
  }

  async function handleDeleteCoach(id: string) {
    if (!window.confirm('確定刪除此輔導紀錄？')) return;
    try {
      await deleteCoachingRecord(id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '刪除失敗');
    }
  }

  const hasEnrollments = enrollments.some((e) => e.active);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── 證照紀錄 ── */}
      <article style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={h2Style}>證照紀錄</h2>
          <button
            style={addBtnStyle}
            onClick={() => setAddCertOpen(true)}
            disabled={!hasEnrollments}
            title={hasEnrollments ? undefined : '學生未加入任何班級'}
          >
            ＋ 新增
          </button>
        </div>
        {certifications.length === 0 ? (
          <p style={placeholderStyle}>尚無證照紀錄</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {['證照名稱', '考試日期', '結果', '班級', '備註', ''].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {certifications.map((c) => (
                <tr key={c.id}>
                  <td style={tdStyle}>{c.certName}</td>
                  <td style={tdStyle}>{c.examDate}</td>
                  <td style={tdStyle}>
                    <span style={c.passed ? passStyle : failStyle}>
                      {c.passed ? '通過' : '未通過'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: '#6b7280', fontSize: '0.85rem' }}>
                    <code>{c.courseId}</code>
                  </td>
                  <td style={{ ...tdStyle, color: '#6b7280' }}>{c.notes ?? '—'}</td>
                  <td style={tdStyle}>
                    <button style={deleteBtnStyle} onClick={() => handleDeleteCert(c.id)}>刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      {/* ── 就業狀態歷程 ── */}
      <article style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={h2Style}>就業狀態歷程</h2>
          <button
            style={addBtnStyle}
            onClick={() => setAddEmpOpen(true)}
            disabled={!hasEnrollments}
            title={hasEnrollments ? undefined : '學生未加入任何班級'}
          >
            ＋ 新增
          </button>
        </div>
        {employmentStatuses.length === 0 ? (
          <p style={placeholderStyle}>尚無就業狀態紀錄</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {['追蹤日期', '狀態', '任職公司', '職務', '薪資', '與訓練相關', '班級', ''].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employmentStatuses.map((s, idx) => (
                <tr key={s.id} style={idx === 0 ? latestRowStyle : {}}>
                  <td style={tdStyle}>
                    {s.trackedAt}
                    {idx === 0 && (
                      <span style={latestBadgeStyle}>最新</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={statusPillStyle(s.status)}>
                      {EMPLOYMENT_STATUS_LABELS[s.status]}
                    </span>
                  </td>
                  <td style={tdStyle}>{s.company ?? '—'}</td>
                  <td style={tdStyle}>{s.jobTitle ?? '—'}</td>
                  <td style={tdStyle}>
                    {s.salaryRange ? SALARY_RANGE_LABELS[s.salaryRange] : '—'}
                  </td>
                  <td style={tdStyle}>
                    {s.relatedToTraining ? RELATED_TO_TRAINING_LABELS[s.relatedToTraining] : '—'}
                  </td>
                  <td style={{ ...tdStyle, color: '#6b7280', fontSize: '0.85rem' }}>
                    <code>{s.courseId}</code>
                  </td>
                  <td style={tdStyle}>
                    <button style={deleteBtnStyle} onClick={() => handleDeleteEmp(s.id)}>刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      {/* ── 輔導紀錄時間軸 ── */}
      <article style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={h2Style}>輔導紀錄</h2>
          <button
            style={addBtnStyle}
            onClick={() => setAddCoachOpen(true)}
            disabled={!hasEnrollments}
            title={hasEnrollments ? undefined : '學生未加入任何班級'}
          >
            ＋ 新增
          </button>
        </div>
        {coachingRecords.length === 0 ? (
          <p style={placeholderStyle}>尚無輔導紀錄</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {coachingRecords.map((r) => (
              <div key={r.id} style={timelineItemStyle}>
                <div style={timelineLeftStyle}>
                  <div style={timelineDotStyle} />
                  <span style={timelineDateStyle}>{formatTs(r.contactAt)}</span>
                </div>
                <div style={timelineBodyStyle}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={counselorStyle}>{r.counselorName}</span>
                    <span style={methodPillStyle}>
                      {CONTACT_METHOD_LABELS[r.contactMethod]}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                      <code>{r.courseId}</code>
                    </span>
                  </div>
                  <p style={coachContentStyle}>{r.content}</p>
                  {r.nextContactDate && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                      下次追蹤：{r.nextContactDate}
                    </p>
                  )}
                </div>
                <button
                  style={{ ...deleteBtnStyle, alignSelf: 'flex-start' }}
                  onClick={() => handleDeleteCoach(r.id)}
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
        )}
      </article>

      {/* Dialogs */}
      {addCertOpen && (
        <AddCertDialog
          studentId={studentId}
          enrollments={enrollments}
          onClose={() => setAddCertOpen(false)}
        />
      )}
      {addEmpOpen && (
        <AddEmploymentDialog
          studentId={studentId}
          enrollments={enrollments}
          onClose={() => setAddEmpOpen(false)}
        />
      )}
      {addCoachOpen && (
        <AddCoachingDialog
          studentId={studentId}
          enrollments={enrollments}
          onClose={() => setAddCoachOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  padding: '1.25rem',
};

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.75rem',
};

const h2Style: React.CSSProperties = {
  margin: 0,
  fontSize: '1.05rem',
  color: '#374151',
};

const addBtnStyle: React.CSSProperties = {
  padding: '0.3rem 0.75rem',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.85rem',
  cursor: 'pointer',
};

const placeholderStyle: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '0.9rem',
  margin: 0,
  fontStyle: 'italic',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.4rem 0.5rem',
  color: '#6b7280',
  fontSize: '0.8rem',
  fontWeight: 600,
  borderBottom: '1px solid #e5e7eb',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.5rem',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'middle',
};

const deleteBtnStyle: React.CSSProperties = {
  padding: '0.2rem 0.55rem',
  background: '#fff',
  color: '#b91c1c',
  border: '1px solid #fecaca',
  borderRadius: 5,
  fontSize: '0.8rem',
  cursor: 'pointer',
};

const passStyle: React.CSSProperties = {
  padding: '0.1rem 0.5rem',
  background: '#dcfce7',
  color: '#166534',
  borderRadius: 10,
  fontSize: '0.8rem',
};

const failStyle: React.CSSProperties = {
  padding: '0.1rem 0.5rem',
  background: '#fee2e2',
  color: '#991b1b',
  borderRadius: 10,
  fontSize: '0.8rem',
};

const latestRowStyle: React.CSSProperties = {
  background: '#eff6ff',
};

const latestBadgeStyle: React.CSSProperties = {
  marginLeft: '0.4rem',
  padding: '0.05rem 0.4rem',
  background: '#2563eb',
  color: '#fff',
  borderRadius: 10,
  fontSize: '0.7rem',
};

function statusPillStyle(status: EmploymentStatusType): React.CSSProperties {
  const map: Record<EmploymentStatusType, React.CSSProperties> = {
    employed: { background: '#dcfce7', color: '#166534' },
    self_employed: { background: '#d1fae5', color: '#065f46' },
    unemployed: { background: '#fee2e2', color: '#991b1b' },
    studying: { background: '#dbeafe', color: '#1d4ed8' },
    other: { background: '#f3f4f6', color: '#6b7280' },
  };
  return {
    padding: '0.1rem 0.5rem',
    borderRadius: 10,
    fontSize: '0.8rem',
    ...(map[status] ?? map.other),
  };
}

const timelineItemStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  padding: '0.75rem',
  background: '#f9fafb',
  borderRadius: 6,
};

const timelineLeftStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minWidth: 120,
};

const timelineDotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: '#2563eb',
  marginBottom: '0.25rem',
  flexShrink: 0,
};

const timelineDateStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#6b7280',
  textAlign: 'center',
};

const timelineBodyStyle: React.CSSProperties = {
  flex: 1,
};

const counselorStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '0.9rem',
};

const methodPillStyle: React.CSSProperties = {
  padding: '0.1rem 0.45rem',
  background: '#e0f2fe',
  color: '#0369a1',
  borderRadius: 10,
  fontSize: '0.78rem',
};

const coachContentStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
  color: '#374151',
  lineHeight: 1.5,
};

// Dialog styles
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
};

const modalStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 10,
  padding: '1.5rem',
  width: '100%',
  maxWidth: 480,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
};

const modalTitleStyle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '1.1rem',
  color: '#111827',
};

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '6rem 1fr',
  columnGap: '0.75rem',
  rowGap: '0.65rem',
  alignItems: 'start',
};

const labelStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '0.85rem',
  paddingTop: '0.45rem',
};

const inputStyle: React.CSSProperties = {
  padding: '0.45rem 0.6rem',
  border: '1px solid #d1d5db',
  borderRadius: 5,
  fontSize: '0.9rem',
  width: '100%',
  boxSizing: 'border-box',
};

const modalActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.5rem',
  marginTop: '1.25rem',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#fff',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: '0.9rem',
};

const saveBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1.2rem',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.9rem',
};
