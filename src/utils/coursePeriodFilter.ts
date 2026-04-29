// 班級期間 filter 共用邏輯（ClassesPage / InstructorSchedulePage 共用）
//
// 規則（皆以「本月」為當下系統日的月份）：
//   本月開課：月(courseStartDate) === 本月
//   本月結束：月(courseEndDate)   === 本月
//   上月開課：月(courseStartDate) === 上月
//   下月結束：月(courseEndDate)   === 下月
//   本季開課：季(courseStartDate) === 本季
//   本季結束：季(courseEndDate)   === 本季
//
// 注意：缺少對應日期的班級，若 preset 不是 all，一律不通過 filter。

export type CoursePeriodPreset =
  | 'all'
  | 'thisMonthStart'
  | 'thisMonthEnd'
  | 'lastMonthStart'
  | 'nextMonthEnd'
  | 'thisQuarterStart'
  | 'thisQuarterEnd';

export const COURSE_PERIOD_OPTIONS: ReadonlyArray<{
  value: CoursePeriodPreset;
  label: string;
}> = [
  { value: 'all', label: '全部' },
  { value: 'thisMonthStart', label: '本月開課' },
  { value: 'thisMonthEnd', label: '本月結束' },
  { value: 'lastMonthStart', label: '上月開課' },
  { value: 'nextMonthEnd', label: '下月結束' },
  { value: 'thisQuarterStart', label: '本季開課' },
  { value: 'thisQuarterEnd', label: '本季結束' },
];

function ymOf(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

function quarterOf(date: string): string {
  const y = date.slice(0, 4);
  const m = parseInt(date.slice(5, 7), 10);
  if (!Number.isFinite(m) || m < 1 || m > 12) return '';
  const q = Math.ceil(m / 3);
  return `${y}-Q${q}`;
}

function ymAt(now: Date, monthDelta: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() + monthDelta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function quarterAt(now: Date): string {
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

export function matchesCoursePeriod(
  preset: CoursePeriodPreset,
  courseStartDate: string,
  courseEndDate: string,
  now: Date = new Date(),
): boolean {
  if (preset === 'all') return true;

  switch (preset) {
    case 'thisMonthStart':
      return !!courseStartDate && ymOf(courseStartDate) === ymAt(now, 0);
    case 'thisMonthEnd':
      return !!courseEndDate && ymOf(courseEndDate) === ymAt(now, 0);
    case 'lastMonthStart':
      return !!courseStartDate && ymOf(courseStartDate) === ymAt(now, -1);
    case 'nextMonthEnd':
      return !!courseEndDate && ymOf(courseEndDate) === ymAt(now, 1);
    case 'thisQuarterStart':
      return !!courseStartDate && quarterOf(courseStartDate) === quarterAt(now);
    case 'thisQuarterEnd':
      return !!courseEndDate && quarterOf(courseEndDate) === quarterAt(now);
  }
}
