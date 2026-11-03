const ZONE = "Europe/Dublin";

export type ZonedResult =
  | { ok: true; utc: string }
  | { ok: false; reason: "invalid" | "ambiguous" | "nonexistent" };

function parts(instant: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const bag: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) bag[part.type] = part.value;
  return bag;
}

/** Minutes to add to UTC to reach the wall clock in `timeZone`. */
export function offsetMinutes(utcMs: number, timeZone = ZONE): number {
  const bag = parts(new Date(utcMs), timeZone);
  const asUtc = Date.UTC(
    Number(bag.year),
    Number(bag.month) - 1,
    Number(bag.day),
    Number(bag.hour),
    Number(bag.minute),
    Number(bag.second),
  );
  return Math.round((asUtc - utcMs) / 60_000);
}

export function dublinYmd(instant: Date): string {
  const bag = parts(instant, ZONE);
  return `${bag.year}-${bag.month}-${bag.day}`;
}

export function dublinClock(instant: Date): string {
  const bag = parts(instant, ZONE);
  return `${bag.hour}:${bag.minute}`;
}

/**
 * Convert a Dublin wall clock to UTC.
 * The overlap when clocks go back is ambiguous. The spring gap does not exist.
 * Callers must not guess an offset from a fixed calendar date.
 */
export function zonedToUtc(ymd: string, hhmm: string, timeZone = ZONE): ZonedResult {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  const clock = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match || !clock) return { ok: false, reason: "invalid" };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return { ok: false, reason: "invalid" };
  }
  const wall = Date.UTC(year, month - 1, day, hour, minute, 0);
  const matches: number[] = [];
  for (const off of [0, 60]) {
    const utc = wall - off * 60_000;
    if (offsetMinutes(utc, timeZone) !== off) continue;
    const bag = parts(new Date(utc), timeZone);
    if (`${bag.year}-${bag.month}-${bag.day}` === ymd && `${bag.hour}:${bag.minute}` === hhmm) {
      matches.push(utc);
    }
  }
  if (matches.length === 1) return { ok: true, utc: new Date(matches[0]!).toISOString() };
  if (matches.length === 0) return { ok: false, reason: "nonexistent" };
  return { ok: false, reason: "ambiguous" };
}

export function formatDublin(iso: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "—";
  return `${dublinYmd(instant)} ${dublinClock(instant)}`;
}
