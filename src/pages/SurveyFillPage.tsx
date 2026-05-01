// 學員問卷填寫頁（F3）
//
// 路由：/survey/:responseId — 無需登入
// 學員透過管理員提供的連結（或 Kiosk QR code）填寫問卷。

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { fetchSurveyResponse, submitSurveyResponse } from '../services/surveys';
import {
  DEFAULT_SURVEY_QUESTIONS,
  SCALE5_OPTIONS,
  YESNO_OPTIONS,
  type SurveyResponseDoc,
} from '../types/survey';

export function SurveyFillPage() {
  const { responseId } = useParams<{ responseId: string }>();
  const [response, setResponse] = useState<SurveyResponseDoc | null | 'missing'>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!responseId) return;
    fetchSurveyResponse(responseId)
      .then((doc) => {
        if (!doc) {
          setResponse('missing');
        } else {
          setResponse(doc);
          if (doc.status === 'submitted') {
            setAnswers(doc.answers);
            setDone(true);
          }
        }
      })
      .catch(() => setResponse('missing'));
  }, [responseId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!responseId || !response || response === 'missing') return;

    // 檢查所有題目都有作答
    const unanswered = DEFAULT_SURVEY_QUESTIONS.filter(
      (q) => !answers[String(q.id)],
    );
    if (unanswered.length > 0) {
      setError(`請完成所有題目（第 ${unanswered.map((q) => q.id).join('、')} 題未填）`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitSurveyResponse(responseId, answers);
      setDone(true);
    } catch {
      setError('送出失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  if (response === null) {
    return <div style={page.loading}>載入中…</div>;
  }

  if (response === 'missing') {
    return (
      <div style={page.wrap}>
        <div style={page.card}>
          <h1 style={page.title}>找不到問卷</h1>
          <p style={{ color: '#6b7280' }}>此問卷連結無效或已過期。</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={page.wrap}>
        <div style={page.card}>
          <div style={page.doneIcon}>✓</div>
          <h1 style={page.title}>感謝您的填答！</h1>
          <p style={{ color: '#6b7280', textAlign: 'center' }}>
            {response.studentName} 的問卷已成功送出。
          </p>
          {response.status === 'submitted' && (
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center' }}>
              （此問卷已填寫完畢，無法重複送出）
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={page.wrap}>
      <div style={page.card}>
        <div style={page.header}>
          <h1 style={page.title}>課程滿意度調查</h1>
          <p style={page.subtitle}>學員：{response.studentName}</p>
        </div>

        {error && <div style={page.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {DEFAULT_SURVEY_QUESTIONS.map((q, idx) => {
            const options = q.type === 'scale5' ? SCALE5_OPTIONS : YESNO_OPTIONS;
            const selected = answers[String(q.id)] ?? '';
            return (
              <div key={q.id} style={page.qBlock}>
                <p style={page.qText}>
                  <span style={page.qNum}>{idx + 1}.</span> {q.text}
                </p>
                <div style={page.optionRow}>
                  {options.map((opt) => {
                    const active = selected === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        style={{
                          ...page.optBtn,
                          background: active ? '#2563eb' : '#f3f4f6',
                          color: active ? '#fff' : '#374151',
                          borderColor: active ? '#2563eb' : '#d1d5db',
                        }}
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [String(q.id)]: opt.value }))
                        }
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <button
            type="submit"
            style={page.submitBtn}
            disabled={submitting}
          >
            {submitting ? '送出中…' : '送出問卷'}
          </button>
        </form>
      </div>
    </div>
  );
}

const page: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh',
    background: '#f9fafb',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '2rem 1rem',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
    padding: '2rem',
    width: '100%',
    maxWidth: 560,
  },
  loading: {
    color: '#6b7280',
    padding: '2rem',
    textAlign: 'center',
  },
  header: { marginBottom: '1.5rem' },
  title: { margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 700 },
  subtitle: { margin: 0, color: '#6b7280', fontSize: '0.9rem' },
  errorBox: {
    padding: '0.65rem 0.8rem',
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    borderRadius: 6,
    marginBottom: '1rem',
    fontSize: '0.9rem',
  },
  qBlock: {
    marginBottom: '1.5rem',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid #f3f4f6',
  },
  qText: {
    margin: '0 0 0.75rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#111827',
  },
  qNum: { color: '#6b7280', marginRight: '0.3rem' },
  optionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  optBtn: {
    padding: '0.45rem 1rem',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  submitBtn: {
    marginTop: '0.5rem',
    width: '100%',
    padding: '0.8rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  doneIcon: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '1.8rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1rem',
  },
};
