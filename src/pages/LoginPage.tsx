// Login Page（Task 005）
//
// Email/Password 登入。登入成功後依角色 + branchIds 決定首頁：
//   hq_admin    → /hq-dashboard
//   其他角色     → /branch-dashboard/{branchIds[0]}

import { useEffect, useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Navigate, useLocation } from 'react-router-dom';

import { auth } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { defaultLandingPath } from '../types/user';

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const { user, loading, error: authError } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (formError) setFormError(null);
    // 清掉舊錯誤，避免下一次輸入時還顯示
    // (依賴 email/password 變動)
  }, [email, password]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loading && user) {
    const redirectTo = (location.state as LocationState | null)?.from ?? defaultLandingPath(user);
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // 成功後 onAuthStateChanged 會更新 user → 上方 <Navigate> 接手導向
    } catch (e) {
      setFormError(translateAuthError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <h1 style={styles.title}>SAMS 登入</h1>
        <p style={styles.subtitle}>學生到校管理系統</p>

        <label style={styles.label}>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            disabled={submitting}
          />
        </label>

        <label style={styles.label}>
          密碼
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            disabled={submitting}
          />
        </label>

        {(formError || authError) && (
          <div style={styles.error}>{formError ?? authError}</div>
        )}

        <button type="submit" disabled={submitting} style={styles.button}>
          {submitting ? '登入中…' : '登入'}
        </button>
      </form>
    </main>
  );
}

function translateAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Email 格式錯誤';
    case 'auth/user-disabled':
      return '此帳號已被停用';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email 或密碼錯誤';
    case 'auth/too-many-requests':
      return '嘗試次數過多，請稍後再試';
    case 'auth/network-request-failed':
      return '網路連線失敗';
    default:
      return e instanceof Error ? e.message : '登入失敗';
  }
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f3f4f6',
  },
  card: {
    background: '#fff',
    padding: '2.5rem',
    borderRadius: 12,
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    width: '100%',
    maxWidth: 380,
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: 0, color: '#6b7280', fontSize: '0.9rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' },
  input: {
    padding: '0.6rem 0.75rem',
    fontSize: '1rem',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    outline: 'none',
  },
  button: {
    padding: '0.7rem',
    fontSize: '1rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontWeight: 600,
  },
  error: {
    padding: '0.6rem 0.75rem',
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    borderRadius: 6,
    fontSize: '0.9rem',
  },
};
