import { roiOf, settleWin, type WinLeg, type WinOutcome } from "./settlement.ts";

export type Distribution = { key: string; p: number };

export function normalize(rows: Distribution[]): Distribution[] | null {
  if (rows.length === 0) return null;
  if (rows.some((row) => !Number.isFinite(row.p) || row.p < 0)) return null;
  const sum = rows.reduce((acc, row) => acc + row.p, 0);
  if (!(sum > 0)) return null;
  return rows.map((row) => ({ key: row.key, p: row.p / sum }));
}

export function uniform(keys: string[]): Distribution[] {
  if (keys.length === 0) return [];
  const p = 1 / keys.length;
  return keys.map((key) => ({ key, p }));
}

/** One book, one market. Missing prices stay missing. */
export function fromWinPrices(
  rows: { key: string; decimal: number | null }[],
): Distribution[] | null {
  if (rows.length === 0 || rows.some((row) => row.decimal == null)) return null;
  const implied = rows.map((row) => ({ key: row.key, p: 1 / (row.decimal as number) }));
  return normalize(implied);
}

export function multiclassBrier(probs: Distribution[], winner: string): number | null {
  const clean = normalize(probs);
  if (!clean || !clean.some((row) => row.key === winner)) return null;
  let score = 0;
  for (const row of clean) {
    const y = row.key === winner ? 1 : 0;
    score += (row.p - y) ** 2;
  }
  return score;
}

export function logLoss(probs: Distribution[], winner: string): number | null {
  const clean = normalize(probs);
  const row = clean?.find((item) => item.key === winner);
  if (!row || row.p <= 0) return null;
  return -Math.log(Math.min(1 - 1e-15, row.p));
}

export type ClvPrice = {
  book: string;
  market: string;
  runnerKey: string;
  decimal: number;
  kind: "recorded" | "observed-close" | "official-sp";
};

export function priceClv(recorded: ClvPrice, close: ClvPrice): { clv: number } | { error: string } {
  if (recorded.kind !== "recorded") return { error: "a cotação registada não está marcada" };
  if (close.kind === "recorded") return { error: "o fecho não pode ser a própria cotação registada" };
  if (recorded.book !== close.book) return { error: "casa diferente" };
  if (recorded.market !== close.market) return { error: "mercado diferente" };
  if (recorded.runnerKey !== close.runnerKey) return { error: "selecção diferente" };
  if (!(recorded.decimal > 1) || !(close.decimal > 1)) return { error: "odd inválida" };
  return { clv: recorded.decimal / close.decimal - 1 };
}

export type Curve = { points: number[]; peak: number; maxDrawdown: number };

export function equityCurve(profits: number[]): Curve {
  const points: number[] = [];
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const profit of profits) {
    equity += profit;
    points.push(equity);
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }
  return { points, peak, maxDrawdown };
}

export type BankEvent =
  | { t: string; seq: number; kind: "stake"; id: string; amount: number }
  | { t: string; seq: number; kind: "settle"; id: string; profit: number };

export type BankState = {
  cash: number;
  reserved: number;
  available: number;
  accepted: string[];
  rejected: string[];
  peakCash: number;
  maxDrawdown: number;
};

/**
 * Cash is settled money. Reserved is stake on races that have not settled.
 * Available is what can still be staked. Open profit is not cash.
 */
export function runBankroll(initial: number, events: BankEvent[]): BankState {
  if (!(initial >= 0) || !Number.isFinite(initial)) throw new Error("Banca inicial inválida.");
  const ordered = [...events].sort((a, b) => a.t.localeCompare(b.t) || a.seq - b.seq);
  const stakes = new Map<string, number>();
  let cash = initial;
  let reserved = 0;
  let peak = initial;
  let maxDrawdown = 0;
  const accepted: string[] = [];
  const rejected: string[] = [];
  for (const event of ordered) {
    if (event.kind === "stake") {
      const available = cash - reserved;
      if (!(event.amount > 0) || event.amount > available + 1e-9) {
        rejected.push(event.id);
        continue;
      }
      reserved += event.amount;
      stakes.set(event.id, event.amount);
      accepted.push(event.id);
      continue;
    }
    const stake = stakes.get(event.id);
    if (stake == null) continue;
    reserved -= stake;
    cash += event.profit;
    stakes.delete(event.id);
    peak = Math.max(peak, cash);
    maxDrawdown = Math.max(maxDrawdown, peak - cash);
  }
  return {
    cash,
    reserved,
    available: cash - reserved,
    accepted,
    rejected,
    peakCash: peak,
    maxDrawdown,
  };
}

export type MetricRow = {
  probs: Distribution[];
  winner: string | null;
  leg: WinLeg | null;
  recorded: ClvPrice | null;
  close: ClvPrice | null;
};

export function summarize(rows: MetricRow[]) {
  const briers: number[] = [];
  const losses: number[] = [];
  let hits = 0;
  let hitN = 0;
  const outcomes: WinOutcome[] = [];
  const clvs: number[] = [];
  const excluded: { reason: string; n: number }[] = [];
  const bump = (reason: string) => {
    const found = excluded.find((item) => item.reason === reason);
    if (found) found.n += 1;
    else excluded.push({ reason, n: 1 });
  };
  for (const row of rows) {
    if (row.winner) {
      const brier = multiclassBrier(row.probs, row.winner);
      const loss = logLoss(row.probs, row.winner);
      if (brier == null || loss == null) bump("distribuição inválida");
      else {
        briers.push(brier);
        losses.push(loss);
        hitN += 1;
        const top = [...normalize(row.probs)!].sort((a, b) => b.p - a.p || a.key.localeCompare(b.key))[0];
        if (top?.key === row.winner) hits += 1;
      }
    } else bump("sem vencedor");
    if (row.leg) outcomes.push(settleWin(row.leg));
    else bump("sem liquidação WIN");
    if (row.recorded && row.close) {
      const clv = priceClv(row.recorded, row.close);
      if ("error" in clv) bump(`clv: ${clv.error}`);
      else clvs.push(clv.clv);
    } else if (row.recorded || row.close) bump("clv incompleto");
  }
  const roi = roiOf(outcomes);
  const curve = equityCurve(outcomes.filter((item) => item.standing).map((item) => item.profit));
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    hitRate: hitN ? hits / hitN : null,
    hitN,
    hits,
    brier: mean(briers),
    logloss: mean(losses),
    roi: roi.roi,
    roiN: roi.standing,
    clv: mean(clvs),
    clvN: clvs.length,
    excluded: [...excluded, ...roi.excluded],
    curve,
  };
}
