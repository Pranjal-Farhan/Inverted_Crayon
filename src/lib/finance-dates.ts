/**
 * Date handling for the finance section. Everything is read and written in Bangladesh time
 * (Asia/Dhaka, a fixed +06:00 — no daylight saving), because "today's expenses" and "this month's
 * profit" mean the shop's calendar, not the server's (which on Vercel is UTC). Client-safe.
 */
const TZ = "Asia/Dhaka";
const OFFSET = "+06:00";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** "2026-10-15" — the Dhaka calendar day this moment falls on. */
export function dhakaDay(d: Date): string {
  return dayFmt.format(d);
}

/** "2026-10" */
export function dhakaMonth(d: Date): string {
  return dhakaDay(d).slice(0, 7);
}

export const todayDhaka = () => dhakaDay(new Date());

const isDay = (s: string | undefined | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00${OFFSET}`).getTime());

/** The moment a Dhaka calendar day begins. */
export function dayStart(day: string): Date {
  return new Date(`${day}T00:00:00${OFFSET}`);
}

/** The moment the day AFTER `day` begins — an exclusive upper bound for "up to and including day". */
export function dayAfter(day: string): Date {
  return new Date(dayStart(day).getTime() + 24 * 3600 * 1000);
}

/** Entries typed in as a plain date (an expense…) are stored at midday Dhaka time, so no timezone can nudge them onto the neighbouring day. */
export function entryDate(day: string): Date {
  return new Date(`${day}T12:00:00${OFFSET}`);
}

export function addDays(day: string, n: number): string {
  return dhakaDay(new Date(dayStart(day).getTime() + n * 24 * 3600 * 1000 + 12 * 3600 * 1000));
}

export function monthStart(month: string): string {
  return `${month}-01`;
}

export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

export function formatDayOf(d: Date): string {
  return formatDay(dhakaDay(d));
}

export const PRESETS = [
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "this-year", label: "This year" },
  { id: "all", label: "All time" },
] as const;
export type PresetId = (typeof PRESETS)[number]["id"];

export type DateRange = {
  /** Inclusive Dhaka calendar days; null = no bound. */
  from: string | null;
  to: string | null;
  preset: PresetId | "custom";
  label: string;
};

/** Reads ?range=…&from=…&to=… into a range. A custom from/to wins over a preset; the default is this month. */
export function resolveRange(params: { range?: string; from?: string; to?: string }): DateRange {
  const today = todayDhaka();
  if (isDay(params.from) || isDay(params.to)) {
    let from = isDay(params.from) ? params.from : null;
    let to = isDay(params.to) ? params.to : null;
    if (from && to && from > to) [from, to] = [to, from];
    const label = from && to ? `${formatDay(from)} – ${formatDay(to)}` : from ? `From ${formatDay(from)}` : `Up to ${formatDay(to!)}`;
    return { from, to, preset: "custom", label };
  }
  const month = dhakaMonth(new Date());
  switch (params.range) {
    case "all":
      return { from: null, to: null, preset: "all", label: "All time" };
    case "last-month": {
      const m = shiftMonth(month, -1);
      return { from: monthStart(m), to: monthEnd(m), preset: "last-month", label: monthLabel(m) };
    }
    case "30d":
      return { from: addDays(today, -29), to: today, preset: "30d", label: "Last 30 days" };
    case "90d":
      return { from: addDays(today, -89), to: today, preset: "90d", label: "Last 90 days" };
    case "this-year":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31`, preset: "this-year", label: today.slice(0, 4) };
    default:
      return { from: monthStart(month), to: monthEnd(month), preset: "this-month", label: monthLabel(month) };
  }
}

/** True when `d` is inside the range (Dhaka calendar days, both ends inclusive). */
export function inRange(d: Date, range: DateRange): boolean {
  if (range.from && d < dayStart(range.from)) return false;
  if (range.to && d >= dayAfter(range.to)) return false;
  return true;
}

export function rangeQuery(range: DateRange, extra: Record<string, string | undefined> = {}): string {
  const sp = new URLSearchParams();
  if (range.preset === "custom") {
    if (range.from) sp.set("from", range.from);
    if (range.to) sp.set("to", range.to);
  } else if (range.preset !== "this-month") {
    sp.set("range", range.preset);
  }
  for (const [k, v] of Object.entries(extra)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Every month (YYYY-MM) from `from` to `to`, oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let m = from.slice(0, 7);
  const end = to.slice(0, 7);
  while (m <= end && out.length < 600) {
    out.push(m);
    m = shiftMonth(m, 1);
  }
  return out;
}
