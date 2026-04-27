// 日期工具：用本地時區（補習班永遠在台灣）做 YYYY-MM-DD / YYYYMMDD。
// 不引入 date-fns 等第三方套件以保持 bundle 輕量。

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// "2026-04-27"
export function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// "20260427"
export function formatDateCompact(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

// "16:52"
export function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// "16:52:31"
export function formatTimeWithSec(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function todayISO(): string {
  return formatDateISO(new Date());
}

export function todayCompact(): string {
  return formatDateCompact(new Date());
}

// "HH:mm" → 當天 0 時起算的分鐘數
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((s) => Number.parseInt(s, 10));
  return h * 60 + m;
}
