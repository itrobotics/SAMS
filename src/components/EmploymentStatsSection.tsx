// 課程就業統計區塊（ClassDetailPage 使用）
//
// 自行載入資料：getEmploymentSummary(courseId)
// 圖表：recharts BarChart 呈現薪資區間分佈

import { useEffect, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { getEmploymentSummary } from '../services/employmentTracking';
import { SALARY_RANGE_LABELS, type EmploymentSummary } from '../types/employmentTracking';

interface Props {
  courseId: string;
}

export function EmploymentStatsSection({ courseId }: Props) {
  const [summary, setSummary] = useState<EmploymentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    getEmploymentSummary(courseId)
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <p style={placeholderStyle}>載入就業統計中…</p>;
  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>;
  if (!summary || summary.totalStudents === 0) {
    return <p style={placeholderStyle}>尚無就業追蹤資料</p>;
  }

  const salaryData = (
    Object.entries(SALARY_RANGE_LABELS) as [keyof typeof SALARY_RANGE_LABELS, string][]
  ).map(([key, label]) => ({
    name: label,
    count: summary.salaryDistribution[key],
  }));

  const barColors = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

  return (
    <div>
      {/* Stat cards */}
      <div style={statsGridStyle}>
        <StatCard label="已追蹤學員" value={`${summary.totalStudents} 人`} />
        <StatCard
          label="已就業"
          value={`${summary.employedCount} 人`}
          sub={`就業率 ${summary.employmentRate}%`}
          highlight={summary.employmentRate >= 70}
        />
        <StatCard
          label="證照通過"
          value={summary.certTotalCount === 0 ? '—' : `${summary.certPassCount} / ${summary.certTotalCount}`}
          sub={summary.certTotalCount > 0 ? `通過率 ${summary.certPassRate}%` : undefined}
        />
        <StatCard
          label="與訓練相關"
          value={
            summary.relatedToTrainingDistribution.yes > 0 ||
            summary.relatedToTrainingDistribution.partial > 0
              ? `${
                  summary.relatedToTrainingDistribution.yes +
                  summary.relatedToTrainingDistribution.partial
                } 人`
              : '—'
          }
        />
      </div>

      {/* Salary distribution bar chart */}
      {salaryData.some((d) => d.count > 0) && (
        <div style={{ marginTop: '1rem' }}>
          <p style={chartTitleStyle}>薪資區間分佈</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={salaryData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`${value} 人`, '人數']}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {salaryData.map((_, index) => (
                  <Cell key={index} fill={barColors[index % barColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Related to training breakdown */}
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: '職類相關', count: summary.relatedToTrainingDistribution.yes, color: '#166534', bg: '#dcfce7' },
          { label: '部分相關', count: summary.relatedToTrainingDistribution.partial, color: '#92400e', bg: '#fef3c7' },
          { label: '不相關', count: summary.relatedToTrainingDistribution.no, color: '#6b7280', bg: '#f3f4f6' },
        ].map(({ label, count, color, bg }) => (
          <span key={label} style={{ fontSize: '0.85rem', color, background: bg, padding: '0.2rem 0.6rem', borderRadius: 10 }}>
            {label}：{count} 人
          </span>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ ...statCardStyle, ...(highlight ? { borderColor: '#2563eb' } : {}) }}>
      <p style={statLabelStyle}>{label}</p>
      <p style={{ ...statValueStyle, ...(highlight ? { color: '#2563eb' } : {}) }}>{value}</p>
      {sub && <p style={statSubStyle}>{sub}</p>}
    </div>
  );
}

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: '0.75rem',
};

const statCardStyle: React.CSSProperties = {
  background: '#f9fafb',
  borderRadius: 8,
  padding: '0.75rem 1rem',
  border: '1px solid #e5e7eb',
};

const statLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.8rem',
  color: '#6b7280',
};

const statValueStyle: React.CSSProperties = {
  margin: '0.25rem 0 0',
  fontSize: '1.2rem',
  fontWeight: 700,
  color: '#111827',
};

const statSubStyle: React.CSSProperties = {
  margin: '0.15rem 0 0',
  fontSize: '0.78rem',
  color: '#6b7280',
};

const chartTitleStyle: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '0.85rem',
  color: '#6b7280',
};

const placeholderStyle: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '0.9rem',
  margin: 0,
  fontStyle: 'italic',
};
