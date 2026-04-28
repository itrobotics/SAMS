// HQ 異常提醒區（Task 044）
//
// 規格三類提醒：
//   1. 未到人數過高班級（超過班級總人數 30%）
//   2. 人臉辨識失敗次數過高（單一裝置今日 ≥ 5 次 FAILED）
//   3. 今日未完成點名班級（已過下課時間 60min 仍有 SCHEDULED）
//
// 全部以「卡片 + 列表」呈現；點擊提醒項目可跳到對應 session / branch dashboard。

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';

import { db } from '../services/firebase';
import { ROUTES } from '../routes/paths';
import { timeToMinutes } from '../utils/date';
import {
  FACE_CHECKIN_ATTEMPTS_COLLECTION,
  type FaceCheckinAttemptDoc,
} from '../types/faceCheckinAttempt';
import type { SessionDoc } from '../types/session';
import type { AttendanceRecordDoc } from '../types/attendance';

const ABSENT_RATIO_THRESHOLD = 0.3;
const FACE_FAILURE_THRESHOLD = 5;
const FINISHED_GRACE_MINUTES = 60;

interface AbsentClass {
  sessionId: string;
  className: string;
  branchId: string;
  total: number;
  notArrived: number;
  ratio: number;
}

interface FaceFailHotspot {
  deviceId: string;
  branchId: string;
  count: number;
}

interface UnfinishedClass {
  sessionId: string;
  className: string;
  branchId: string;
  endTime: string;
  pending: number;
}

interface Props {
  date: string;
  sessions: SessionDoc[];
  records: AttendanceRecordDoc[];
}

export function HQAnomalyPanel({ date, sessions, records }: Props) {
  const [faceFails, setFaceFails] = useState<FaceCheckinAttemptDoc[]>([]);

  // 訂閱今日 face_checkin_attempts where result==FAILED
  useEffect(() => {
    const compact = date.split('-').join('');
    const startId = `${compact}_`;
    const endId = `${compact}` + '`';
    // attempt 沒有 date 欄位，但 createdAt 有；若無 sessionId 用 deviceId 反追。
    // 較簡單做法：直接訂全部 result==FAILED 的 attempts，再前端過濾今天。
    // 量不大時可接受；正式環境建議加 date 欄位 + index。
    const q = query(
      collection(db, FACE_CHECKIN_ATTEMPTS_COLLECTION),
      where('result', '==', 'FAILED'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const today = new Date(`${date}T00:00:00`);
      const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
      const list: FaceCheckinAttemptDoc[] = [];
      snap.docs.forEach((d) => {
        const data = d.data() as Omit<FaceCheckinAttemptDoc, 'attemptId'>;
        const createdAt = (data.createdAt as { toDate?: () => Date } | undefined)?.toDate?.();
        if (!createdAt) return;
        if (createdAt >= today && createdAt < tomorrow) {
          list.push({ attemptId: d.id, ...data });
        }
        // 沒 sessionId 也算進去 — 我們只用 deviceId 來分類
        void startId; void endId;
      });
      setFaceFails(list);
    });
    return unsub;
  }, [date]);

  const absentClasses = useMemo<AbsentClass[]>(() => {
    const bySession = new Map<string, { total: number; notArrived: number; session?: SessionDoc }>();
    for (const r of records) {
      const cur = bySession.get(r.sessionId) ?? { total: 0, notArrived: 0 };
      cur.total += 1;
      if (r.status === 'ABSENT' || r.status === 'SCHEDULED') cur.notArrived += 1;
      bySession.set(r.sessionId, cur);
    }
    for (const s of sessions) {
      const cur = bySession.get(s.sessionId);
      if (cur) cur.session = s;
    }
    const out: AbsentClass[] = [];
    for (const [sessionId, info] of bySession) {
      if (info.total === 0) continue;
      const ratio = info.notArrived / info.total;
      if (ratio < ABSENT_RATIO_THRESHOLD) continue;
      out.push({
        sessionId,
        className: info.session?.className ?? sessionId,
        branchId: info.session?.branchId ?? '?',
        total: info.total,
        notArrived: info.notArrived,
        ratio,
      });
    }
    return out.sort((a, b) => b.ratio - a.ratio);
  }, [sessions, records]);

  const faceFailHotspots = useMemo<FaceFailHotspot[]>(() => {
    const map = new Map<string, FaceFailHotspot>();
    for (const f of faceFails) {
      const key = f.deviceId;
      const cur = map.get(key) ?? { deviceId: f.deviceId, branchId: f.branchId, count: 0 };
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .filter((h) => h.count >= FACE_FAILURE_THRESHOLD)
      .sort((a, b) => b.count - a.count);
  }, [faceFails]);

  const unfinishedClasses = useMemo<UnfinishedClass[]>(() => {
    const nowMin = nowMinutes();
    const out: UnfinishedClass[] = [];
    for (const s of sessions) {
      const endMin = timeToMinutes(s.endTime);
      if (nowMin < endMin + FINISHED_GRACE_MINUTES) continue;
      const recs = records.filter((r) => r.sessionId === s.sessionId);
      const pending = recs.filter((r) => r.status === 'SCHEDULED').length;
      if (pending > 0) {
        out.push({
          sessionId: s.sessionId,
          className: s.className,
          branchId: s.branchId,
          endTime: s.endTime,
          pending,
        });
      }
    }
    return out;
  }, [sessions, records]);

  const hasAny = absentClasses.length + faceFailHotspots.length + unfinishedClasses.length > 0;

  if (!hasAny) {
    return (
      <div style={styles.allGood}>
        ✓ 目前無異常 — 所有班級到班率正常、無大量人臉失敗、無未完成點名
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.h2}>異常提醒</h2>
      <div style={styles.grid}>
        {absentClasses.length > 0 && (
          <Card title="未到比例過高班級" accent="#b91c1c" count={absentClasses.length}>
            <ul style={styles.list}>
              {absentClasses.slice(0, 8).map((c) => (
                <li key={c.sessionId} style={styles.listItem}>
                  <Link to={ROUTES.session(c.sessionId)}>{c.className}</Link>
                  <span style={{ color: '#b91c1c', marginLeft: '0.5rem' }}>
                    {c.notArrived}/{c.total}（{(c.ratio * 100).toFixed(0)}%）
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {faceFailHotspots.length > 0 && (
          <Card title="人臉辨識失敗熱點" accent="#92400e" count={faceFailHotspots.length}>
            <ul style={styles.list}>
              {faceFailHotspots.map((h) => (
                <li key={h.deviceId} style={styles.listItem}>
                  <Link to={ROUTES.branchDashboard(h.branchId)}>
                    <code>{h.deviceId}</code>（{h.branchId}）
                  </Link>
                  <span style={{ color: '#92400e', marginLeft: '0.5rem' }}>
                    {h.count} 次失敗
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {unfinishedClasses.length > 0 && (
          <Card title="未完成點名班級" accent="#1e40af" count={unfinishedClasses.length}>
            <ul style={styles.list}>
              {unfinishedClasses.map((c) => (
                <li key={c.sessionId} style={styles.listItem}>
                  <Link to={ROUTES.session(c.sessionId)}>{c.className}</Link>
                  <span style={{ color: '#1e40af', marginLeft: '0.5rem' }}>
                    {c.endTime} 結束 · 仍有 {c.pending} 人未處理
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({
  title, accent, count, children,
}: {
  title: string; accent: string; count: number; children: React.ReactNode;
}) {
  return (
    <article style={{ ...styles.card, borderLeft: `4px solid ${accent}` }}>
      <header style={styles.cardHead}>
        <h3 style={{ ...styles.cardTitle, color: accent }}>{title}</h3>
        <span style={{ ...styles.badge, background: accent }}>{count}</span>
      </header>
      {children}
    </article>
  );
}

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { marginBottom: '1.25rem' },
  h2: { margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#374151' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '0.75rem',
  },
  card: {
    background: '#fff', borderRadius: 8, padding: '0.85rem 1rem',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' },
  cardTitle: { margin: 0, fontSize: '0.95rem', fontWeight: 600 },
  badge: {
    color: '#fff', padding: '0.05rem 0.45rem', borderRadius: 10,
    fontSize: '0.75rem', fontWeight: 600,
  },
  list: { margin: 0, padding: 0, listStyle: 'none' },
  listItem: { padding: '0.3rem 0', fontSize: '0.9rem', borderBottom: '1px solid #f3f4f6' },
  allGood: {
    padding: '0.75rem 1rem', background: '#f0fdf4',
    border: '1px solid #bbf7d0', color: '#166534',
    borderRadius: 8, marginBottom: '1.25rem', fontSize: '0.9rem',
  },
};
