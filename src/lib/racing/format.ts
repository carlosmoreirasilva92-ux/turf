export const DESK_YMD = "2026-11-02";
export const DESK_TIME = "14:30";
export const DESK_ISO = "2026-11-02T14:30:00+00:00";
export const DESK_MS = Date.parse(DESK_ISO);

export type Currency = "EUR" | "BRL" | "GBP" | "USD";

export const CURRENCIES: { id: Currency; label: string }[] = [
  { id: "EUR", label: "€" },
  { id: "BRL", label: "R$" },
  { id: "GBP", label: "£" },
  { id: "USD", label: "$" },
];

const SYMBOL: Record<Currency, string> = {
  EUR: "€",
  BRL: "R$",
  GBP: "£",
  USD: "$",
};

export function fmtOdd(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

export function fmtPct(n: number, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtSignedPct(n: number, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  const v = (n * 100).toFixed(digits);
  return n > 0 ? `+${v}%` : `${v}%`;
}

export function fmtNum(n: number | null | undefined, digits = 3) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function moneyBody(abs: number, currency: Currency) {
  const [whole, frac] = abs.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${SYMBOL[currency]} ${grouped},${frac}`;
}

export function fmtMoney(n: number, currency: Currency) {
  if (!Number.isFinite(n)) return "—";
  const body = moneyBody(Math.abs(n), currency);
  return n < 0 ? `−${body}` : body;
}

export function fmtSignedMoney(n: number, currency: Currency) {
  if (!Number.isFinite(n)) return "—";
  const body = moneyBody(Math.abs(n), currency);
  if (n > 0) return `+${body}`;
  if (n < 0) return `−${body}`;
  return body;
}

export function fmtShort(ymd: string) {
  const [, m, d] = ymd.split("-");
  return `${Number(d)}/${m}`;
}

export function fmtDayLabel(ymd: string) {
  if (ymd === DESK_YMD) return "Hoje · 2 de novembro";
  if (ymd === "2026-11-03") return "Amanhã · 3 de novembro";
  const date = new Date(`${ymd}T12:00:00Z`);
  const raw = new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function addDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + n));
  return dt.toISOString().slice(0, 10);
}

export function weekday(ymd: string) {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

/** Dublin wall-clock. IST until the last Sunday of October 2026, then GMT. */
export function offIso(ymd: string, hhmm: string) {
  const offset = ymd < "2026-10-25" ? "+01:00" : "+00:00";
  return `${ymd}T${hhmm}:00${offset}`;
}

export function addMinutes(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (h ?? 0) * 60 + (m ?? 0) + mins;
  const hh = Math.floor(t / 60) % 24;
  const mm = t % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function daysBetween(a: string, b: string) {
  const ms = Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`);
  return Math.round(ms / 86_400_000);
}
