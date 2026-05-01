// 班級報到頁（Task 025）
//
// /session/:sessionId
// 兩個 realtime listener：sessions/{id} 與 attendance_records where sessionId==id。
// 顯示：場次抬頭（班級 / 時段 / 教室 / 老師 / 應到統計）+ 學生表格。
// Task 026 會把右側「操作」欄換成可點按的按鈕；本任務只先呈現資料與狀態欄。

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import {
  useSessionAttendanceRealtime,
  useSessionRealtime,
} from '../hooks/useRealtime';
import { updateAttendance } from '../services/attendance';
import { createLeaveRequest } from '../services/leaveRequests';
import { subscribeBranchSettings } from '../services/settings';
import {
  sendSurveyForSession,
  subscribeSessionSurveyResponses,
  computeSurveyStats,
} from '../services/surveys';
import { ROUTES } from '../routes/paths';
import { decideManualCheckinStatus } from '../utils/attendance';
import { formatTimeWithSec } from '../utils/date';
import { canAccessBranch } from '../types/user';
import { DEFAULT_BRANCH_SETTINGS, type BranchSettings } from '../types/settings';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type AttendanceRecordDoc,
  type AttendanceStatus,
} from '../types/attendance';
import {
  DEFAULT_SURVEY_QUESTIONS,
  type SurveyResponseDoc,
} from '../types/survey';

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const { branches } = useBranches();
  const sessionRT = useSessionRealtime(sessionId);
  const recordsRT = useSessionAttendanceRealtime(sessionId);
  const session = sessionRT.data;
  const records = recordsRT.data;
  const error = sessionRT.error ?? recordsRT.error;
  const sessionLoading = sessionRT.loading;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [settings, setSettings] = useState<BranchSettings | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<AttendanceRecordDoc | null>(null);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponseDoc[]>([]);
  const [surveySending, setSurveySending] = useState(false);
  const [showSurveyStats, setShowSurveyStats] = useState(false);

  // 訂閱該分校設定（取 graceMinutes）
  useEffect(() => {
    const branchId = session ? session.branchId : null;
    if (!branchId) return;
    const unsub = subscribeBranchSettings(branchId, setSettings);
    return unsub;
  }, [session]);

  // 訂閱問卷回覆
  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeSessionSurveyResponses(sessionId, setSurveyResponses);
    return unsub;
  }, [sessionId]);

  // 手動報到：
  //   target='CHECKED_IN' → 依 graceMinutes 自動分流為 CHECKED_IN 或 LATE
  //   target='LEAVE' → 改走請假對話框（記原因 + 建立 leave_requests 紀錄）
  //   其他狀態維持原值
  async function setStatus(record: AttendanceRecordDoc, target: AttendanceStatus) {
    if (target === 'LEAVE') {
      setLeaveTarget(record);
      return;
    }
    setBusyId(record.recordId);
    try {
      let finalStatus: AttendanceStatus = target;
      if (target === 'CHECKED_IN' && session) {
        const grace = settings?.graceMinutes ?? DEFAULT_BRANCH_SETTINGS.graceMinutes;
        finalStatus = decideManualCheckinStatus(
          new Date(),
          session.date,
          session.startTime,
          grace,
        );
      }
      const isPresent = finalStatus === 'CHECKED_IN' || finalStatus === 'LATE';
      await updateAttendance(record.recordId, {
        status: finalStatus,
        method: isPresent ? 'MANUAL' : null,
        confidence: null,
        operatorId: user?.userId ?? null,
        setCheckinNow: isPresent,
        clearCheckin: !isPresent,
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失敗');
    } finally {
      setBusyId(null);
    }
  }

  async function submitLeave(reason: string) {
    if (!leaveTarget || !session) return;
    setBusyId(leaveTarget.recordId);
    try {
      await createLeaveRequest({
        studentId: leaveTarget.studentId,
        studentName: leaveTarget.studentName,
        branchId: leaveTarget.branchId,
        classId: leaveTarget.classId,
        sessionId: leaveTarget.sessionId,
        sessionDate: session.date,
        className: session.className,
        reason: reason.trim(),
        status: 'approved',
        operatorId: user?.userId ?? null,
      });
      setLeaveTarget(null);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '請假登錄失敗');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSendSurvey() {
    if (!sessionId || !session) return;
    const presentRecords = records.filter(
      (r) => r.status === 'CHECKED_IN' || r.status === 'LATE',
    );
    if (presentRecords.length === 0) {
      window.alert('尚無出席學員，無法發送問卷。');
      return;
    }
    setSurveySending(true);
    try {
      const count = await sendSurveyForSession(
        sessionId,
        session.classId,
        session.branchId,
        presentRecords,
      );
      window.alert(count > 0 ? `已為 ${count} 位學員建立問卷。` : '問卷已全部建立（無新增）。');
      setShowSurveyStats(true);
    } catch {
      window.alert('發送問卷失敗，請稍後再試。');
    } finally {
      setSurveySending(false);
    }
  }

  const counts = useMemo(() => {
    const acc: Record<AttendanceStatus, number> = {
      SCHEDULED: 0, CHECKED_IN: 0, LATE: 0, LEAVE: 0, ABSENT: 0, MAKEUP: 0, CANCELLED: 0,
    };
    for (const r of records) acc[r.status] += 1;
    return acc;
  }, [records]);

  if (sessionLoading) return <div style={{ color: '#6b7280' }}>載入中…</div>;
  if (!session) {
    return (
      <section>
        <h1>找不到場次</h1>
        <p><code>{sessionId}</code> 不存在。場次可能尚未產生 → 至「設定」頁觸發產生。</p>
        <Link to={ROUTES.classes}>← 回班級列表</Link>
      </section>
    );
  }

  // 跨分校保護
  if (user && !canAccessBranch(user, session.branchId)) {
    return <Navigate to={ROUTES.login} replace />;
  }

  const branchName = branches.find((b) => b.branchId === session.branchId)?.name ?? session.branchId;

  return (
    <section>
      <header style={styles.header}>
        <div>
          <Link to={ROUTES.branchDashboard(session.branchId)} style={styles.back}>
            ← 回 {branchName} 看板
          </Link>
          <h1 style={styles.title}>{session.className}</h1>
          <p style={styles.subtitle}>
            {session.date} · {session.startTime}–{session.endTime}
            {session.classroom ? ` · 教室 ${session.classroom}` : ''}
            {session.teacherId ? ` · 講師 ${session.teacherId}` : ''}
            {' · '}<code>{session.sessionId}</code>
          </p>
          <p style={styles.graceNote}>
            遲到判定：上課後 {settings?.graceMinutes ?? DEFAULT_BRANCH_SETTINGS.graceMinutes} 分鐘起算
          </p>
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.summary}>
        <SummaryPill label="應到" value={records.length} status="SCHEDULED" />
        <SummaryPill label="已到" value={counts.CHECKED_IN + counts.LATE} status="CHECKED_IN" />
        <SummaryPill label="遲到" value={counts.LATE} status="LATE" />
        <SummaryPill label="請假" value={counts.LEAVE} status="LEAVE" />
        <SummaryPill label="未到" value={counts.ABSENT + counts.SCHEDULED} status="ABSENT" />
      </div>

      {/* 問卷區塊 */}
      <div style={styles.surveyBar}>
        {surveyResponses.length === 0 ? (
          <button
            type="button"
            style={styles.surveyBtn}
            onClick={handleSendSurvey}
            disabled={surveySending}
          >
            {surveySending ? '發送中…' : '📋 發送問卷'}
          </button>
        ) : (
          <button
            type="button"
            style={{ ...styles.surveyBtn, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}
            onClick={() => setShowSurveyStats((v) => !v)}
          >
            📊 問卷統計（{surveyResponses.filter((r) => r.status === 'submitted').length}/{surveyResponses.length} 份已填）
          </button>
        )}
      </div>

      {showSurveyStats && surveyResponses.length > 0 && (
        <SurveyStatsSection responses={surveyResponses} sessionId={sessionId ?? ''} />
      )}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>學生</th>
              <th style={styles.th}>狀態</th>
              <th style={styles.th}>報到時間</th>
              <th style={styles.th}>方式</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={5} style={styles.empty}>
                  此場次尚無應到名單。請至「班級學生管理」加入學生，再重新產生場次。
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.recordId}>
                <td style={styles.td}>
                  <Link to={`/students/${r.studentId}`}>{r.studentName}</Link>
                  <span style={styles.studentIdMeta}><code>{r.studentId}</code></span>
                </td>
                <td style={styles.td}><StatusPill status={r.status} /></td>
                <td style={styles.td}>
                  {r.checkinTime
                    ? formatTimeWithSec(r.checkinTime.toDate())
                    : '—'}
                </td>
                <td style={styles.td}>{methodLabel(r.method)}</td>
                <td style={styles.td}>
                  <ActionButtons
                    record={r}
                    busy={busyId === r.recordId}
                    onSet={setStatus}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LeaveDialog
        record={leaveTarget}
        busy={leaveTarget !== null && busyId === leaveTarget.recordId}
        onClose={() => setLeaveTarget(null)}
        onSubmit={submitLeave}
      />
    </section>
  );
}

function LeaveDialog({
  record, busy, onClose, onSubmit,
}: {
  record: AttendanceRecordDoc | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (record) setReason('');
  }, [record]);

  if (!record) return null;

  return (
    <Modal open={true} title={`登錄請假 — ${record.studentName}`} onClose={busy ? () => {} : onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!reason.trim()) return;
          onSubmit(reason);
        }}
      >
        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.4rem', color: '#374151' }}>
          請假原因（必填）
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="例如：感冒發燒、家庭因素…"
          style={{
            width: '100%',
            padding: '0.55rem 0.7rem',
            fontSize: '0.95rem',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
          autoFocus
          required
        />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={busy || !reason.trim()}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: 'none',
              background: '#1e40af',
              color: '#fff',
              fontWeight: 600,
              opacity: busy || !reason.trim() ? 0.6 : 1,
              cursor: busy || !reason.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? '登錄中…' : '確認請假'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ActionButtons({
  record, busy, onSet,
}: {
  record: AttendanceRecordDoc;
  busy: boolean;
  onSet: (r: AttendanceRecordDoc, s: AttendanceStatus) => Promise<void>;
}) {
  const isPresent = record.status === 'CHECKED_IN' || record.status === 'LATE';
  const isLeave = record.status === 'LEAVE';
  const isAbsent = record.status === 'ABSENT';

  return (
    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
      <ActionBtn
        label="已到"
        active={isPresent}
        accent="#166534"
        disabled={busy}
        onClick={() => onSet(record, 'CHECKED_IN')}
      />
      <ActionBtn
        label="請假"
        active={isLeave}
        accent="#1e40af"
        disabled={busy}
        onClick={() => onSet(record, 'LEAVE')}
      />
      <ActionBtn
        label="未到"
        active={isAbsent}
        accent="#b91c1c"
        disabled={busy}
        onClick={() => onSet(record, 'ABSENT')}
      />
      <ActionBtn
        label="重設"
        active={false}
        accent="#6b7280"
        disabled={busy || record.status === 'SCHEDULED'}
        onClick={() => onSet(record, 'SCHEDULED')}
      />
    </div>
  );
}

function ActionBtn({
  label, active, accent, disabled, onClick,
}: {
  label: string; active: boolean; accent: string; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.25rem 0.6rem',
        fontSize: '0.85rem',
        borderRadius: 6,
        border: `1px solid ${active ? accent : '#d1d5db'}`,
        background: active ? accent : '#fff',
        color: active ? '#fff' : accent,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function methodLabel(m: AttendanceRecordDoc['method']): string {
  if (m === 'FACE') return '人臉';
  if (m === 'MANUAL') return '手動';
  return '—';
}

function StatusPill({ status }: { status: AttendanceStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span style={{ padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.8rem', background: c.bg, color: c.fg }}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function SummaryPill({ label, value, status }: { label: string; value: number; status: AttendanceStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <div style={{ ...styles.card, borderLeft: `4px solid ${c.fg}` }}>
      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: c.fg, marginTop: '0.2rem' }}>{value}</div>
    </div>
  );
}

function SurveyStatsSection({
  responses,
  sessionId,
}: {
  responses: SurveyResponseDoc[];
  sessionId: string;
}) {
  const yesNoIds = DEFAULT_SURVEY_QUESTIONS
    .filter((q) => q.type === 'yesno')
    .map((q) => q.id);
  const allIds = DEFAULT_SURVEY_QUESTIONS.map((q) => q.id);
  const stats = computeSurveyStats(responses, allIds, yesNoIds);

  return (
    <div style={styles.surveyCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#374151' }}>問卷統計</h3>
        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
          回覆率：{(stats.responseRate * 100).toFixed(0)}%（{stats.submitted}/{stats.total}）
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr>
            <th style={styles.sth}>題目</th>
            <th style={styles.sth}>結果</th>
            <th style={styles.sth}>問卷連結</th>
          </tr>
        </thead>
        <tbody>
          {DEFAULT_SURVEY_QUESTIONS.map((q) => {
            const avg = stats.averages[String(q.id)];
            const yesno = stats.yesNoCounts[String(q.id)];
            return (
              <tr key={q.id}>
                <td style={styles.std}>{q.id}. {q.text}</td>
                <td style={styles.std}>
                  {q.type === 'scale5'
                    ? avg !== null
                      ? `${avg.toFixed(2)} 分`
                      : '—'
                    : yesno
                      ? `是 ${yesno.yes} / 否 ${yesno.no} / 部分 ${yesno.partial}`
                      : '—'}
                </td>
                <td style={styles.std} />
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem' }}>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>
          個人問卷連結
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: 180, overflow: 'auto' }}>
          {responses.map((r) => (
            <div key={r.responseId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ minWidth: 80 }}>{r.studentName}</span>
              <span style={{
                padding: '0.1rem 0.4rem', borderRadius: 10, fontSize: '0.75rem',
                background: r.status === 'submitted' ? '#dcfce7' : '#f3f4f6',
                color: r.status === 'submitted' ? '#166534' : '#6b7280',
              }}>
                {r.status === 'submitted' ? '已填' : '待填'}
              </span>
              <a
                href={`/survey/${r.responseId}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.8rem' }}
              >
                填寫連結 ↗
              </a>
              <button
                type="button"
                style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                onClick={() => {
                  const url = `${window.location.origin}/survey/${r.responseId}`;
                  navigator.clipboard.writeText(url).then(() => window.alert('連結已複製'));
                }}
              >
                複製
              </button>
            </div>
          ))}
        </div>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
          場次 ID：{sessionId}
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: '1.25rem' },
  back: { color: '#6b7280', fontSize: '0.9rem', display: 'inline-block', marginBottom: '0.5rem' },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: '0.4rem 0 0', color: '#6b7280', fontSize: '0.9rem' },
  graceNote: { margin: '0.2rem 0 0', color: '#9ca3af', fontSize: '0.8rem' },
  error: {
    padding: '0.6rem 0.75rem', background: '#fef2f2', color: '#b91c1c',
    border: '1px solid #fecaca', borderRadius: 6, marginBottom: '1rem',
  },
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.75rem', marginBottom: '1rem',
  },
  card: {
    background: '#fff', borderRadius: 8, padding: '0.85rem 1rem',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  tableWrap: { background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' },
  th: {
    textAlign: 'left', padding: '0.7rem 1rem', borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb', fontWeight: 600,
  },
  td: { padding: '0.65rem 1rem', borderBottom: '1px solid #f3f4f6' },
  empty: { padding: '2rem', textAlign: 'center', color: '#9ca3af' },
  studentIdMeta: { color: '#9ca3af', fontSize: '0.8rem', marginLeft: '0.5rem' },
  surveyBar: { marginBottom: '1rem' },
  surveyBtn: {
    padding: '0.5rem 1.1rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  surveyCard: {
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    padding: '1.25rem',
    marginBottom: '1rem',
    border: '1px solid #e5e7eb',
  },
  sth: {
    textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb', fontWeight: 600, fontSize: '0.85rem',
  },
  std: { padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' },
};
