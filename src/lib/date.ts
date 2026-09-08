/** Local-timezone date utilities. Never use UTC for day boundaries. */

/** Returns today as YYYY-MM-DD in the device's local timezone. */
export function todayLocal(): string {
  return formatDate(new Date());
}

/** Formats a Date object as YYYY-MM-DD in local timezone. */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses a YYYY-MM-DD string into a Date at midnight local time. */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Adds n days to a YYYY-MM-DD string, returns YYYY-MM-DD. */
export function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

/** Formats a YYYY-MM-DD string for display, e.g. "Mon, 7 Sep" */
export function displayDate(dateStr: string): string {
  const d = parseDate(dateStr);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** Returns true if dateStr is today in local time. */
export function isToday(dateStr: string): boolean {
  return dateStr === todayLocal();
}

/** Returns true if dateStr is in the future relative to today. */
export function isFuture(dateStr: string): boolean {
  return dateStr > todayLocal();
}

/** Returns an array of the last N day strings ending at today. */
export function lastNDays(n: number): string[] {
  const today = todayLocal();
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(addDays(today, -i));
  }
  return days;
}
