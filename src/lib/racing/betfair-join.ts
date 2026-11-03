/** Pure matching between the public card and Betfair WIN backs. No network, no secrets. */

export const VALOR_RATIO = 1.1;

export type CardRunner = {
  name: string;
  cloth: number | null;
  decimal: number | null;
  fractional: string | null;
  status: string;
};

export type CardRace = {
  id: string;
  course: string;
  time: string | null;
  offAt: string | null;
  runners: CardRunner[];
};

export type ExchangeRunner = {
  name: string;
  cloth: number | null;
  back: number | null;
  status: string;
};

export type ExchangeMarket = {
  venue: string;
  start: string;
  runners: ExchangeRunner[];
};

export type BackQuote = {
  back: number;
  percent: number;
  valor: boolean;
  gap: number;
};

export type ValueRow = {
  raceId: string;
  course: string;
  time: string | null;
  horse: string;
  publicDecimal: number;
  publicFractional: string | null;
  back: number;
  percent: number;
  gap: number;
};

export type ExchangeJoin = {
  quotes: Record<string, Record<string, BackQuote>>;
  opportunities: ValueRow[];
};

export type BetfairView =
  | ({ ok: true; receivedAt: string; notice: string } & ExchangeJoin)
  | { ok: false; reason: string };

export function horseKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(ire|gb|fr|usa|us|ger|ity|aus|nz|saf|uae|jpn|arg|brz)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function courseKey(name: string): string {
  return horseKey(name)
    .replace(/\b(park|racecourse)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isValor(publicDecimal: number, back: number): boolean {
  return publicDecimal > 1 && back > 1 && publicDecimal + 1e-9 >= back * VALOR_RATIO;
}

export function gapOf(publicDecimal: number, back: number): number {
  return publicDecimal / back - 1;
}

function coursesMatch(a: string, b: string): boolean {
  const left = courseKey(a);
  const right = courseKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= 4 && longer.startsWith(`${shorter} `);
}

function minutesApart(a: string | null, b: string): number | null {
  if (!a) return null;
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.abs(left - right) / 60_000;
}

function percentOf(back: number): number {
  return Number((100 / back).toFixed(1));
}

export function joinExchange(races: CardRace[], markets: ExchangeMarket[]): ExchangeJoin {
  const quotes: ExchangeJoin["quotes"] = {};
  const opportunities: ValueRow[] = [];
  for (const race of races) {
    let best: { market: ExchangeMarket; delta: number } | null = null;
    for (const market of markets) {
      if (!coursesMatch(race.course, market.venue)) continue;
      const delta = minutesApart(race.offAt, market.start);
      if (delta == null || delta > 5) continue;
      if (!best || delta < best.delta) best = { market, delta };
    }
    if (!best) continue;
    const byName: Record<string, BackQuote> = {};
    for (const runner of race.runners) {
      if (runner.status === "NON_RUNNER") continue;
      const key = horseKey(runner.name);
      if (!key) continue;
      const priced = best.market.runners.filter((row) => row.status === "ACTIVE" && row.back != null && row.back > 1);
      const named = priced.find((row) => horseKey(row.name) === key);
      const byCloth =
        named ??
        (runner.cloth != null
          ? priced.filter((row) => row.cloth === runner.cloth).length === 1
            ? priced.find((row) => row.cloth === runner.cloth)
            : undefined
          : undefined);
      const back = byCloth?.back;
      if (back == null || runner.decimal == null || !(runner.decimal > 1)) continue;
      const valor = isValor(runner.decimal, back);
      const gap = Number(gapOf(runner.decimal, back).toFixed(4));
      const quote = { back, percent: percentOf(back), valor, gap };
      byName[key] = quote;
      if (valor) {
        opportunities.push({
          raceId: race.id,
          course: race.course,
          time: race.time,
          horse: runner.name,
          publicDecimal: runner.decimal,
          publicFractional: runner.fractional,
          back,
          percent: quote.percent,
          gap,
        });
      }
    }
    quotes[race.id] = byName;
  }
  opportunities.sort((a, b) => b.gap - a.gap || a.course.localeCompare(b.course) || (a.time ?? "").localeCompare(b.time ?? ""));
  return { quotes, opportunities };
}
