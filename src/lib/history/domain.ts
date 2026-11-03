import { assignFolds } from "../racing/eval.ts";

export const LONGSHOT_RULE = {
  version: "longshot-example-1",
  minDecimal: 10,
  note: "Odd decimal 10 é um exemplo operacional. Não é a definição universal de azarão.",
} as const;

export const ABSENCE_REASONS = new Set(["unpublished", "uncollected", "na", "restricted", "conflict", "failed"]);
export const INCIDENT_KINDS = new Set(["fall", "brought-down", "unseated", "refused", "pulled-up", "other"]);
export const EPISODE_EVENTS = new Set(["exercise", "gallop", "announced-return", "revision", "clearance", "entry", "comeback"]);

const FEATURE_ALLOW = new Set([
  "prior_runs",
  "prior_wins",
  "days_since_run",
  "runs_14d",
  "wins_14d",
  "runs_30d",
  "wins_30d",
  "runs_90d",
  "wins_90d",
  "layoff_days",
  "horse_jockey_runs",
  "horse_jockey_wins",
  "horse_trainer_runs",
  "horse_trainer_wins",
  "same_course_runs",
  "same_distance_runs",
  "same_going_runs",
  "implied_prob",
]);

export type PriorRun = {
  offAt: string;
  started: boolean;
  position: number | null;
  course: string | null;
  distanceM: number | null;
  going: string | null;
  jockeyKey: string | null;
  trainerKey: string | null;
  preoff: number | null;
};

export function readWeights(runner: Record<string, unknown>): { ok: true; carriedLb: number | null; bodyKg: number | null } | { ok: false; error: string } {
  if ("weight" in runner || "peso" in runner) {
    return { ok: false, error: "Peso sem unidade. Corporal é bodyKg. Carregado é carriedLb." };
  }
  const carried = runner.carriedLb;
  const body = runner.bodyKg;
  if (carried != null && (typeof carried !== "number" || !(carried > 0))) {
    return { ok: false, error: "carriedLb tem de ser um número positivo." };
  }
  if (body != null && (typeof body !== "number" || !(body > 0))) {
    return { ok: false, error: "bodyKg tem de ser um número positivo." };
  }
  return { ok: true, carriedLb: typeof carried === "number" ? carried : null, bodyKg: typeof body === "number" ? body : null };
}

export function incidentCause(published: string | null | undefined): string {
  const text = published?.trim();
  return text ? text : "Causa não informada";
}

export function recoveryLabels(
  documentedReason: string | null | undefined,
  events: { kind: string; eventAt: string | null }[],
): { cause: string; returnLabel: string; entryIsClearance: false; layoffIsInjury: false } {
  const announced = events.filter((event) => event.kind === "announced-return" && event.eventAt);
  return {
    cause: incidentCause(documentedReason),
    returnLabel: announced.length ? announced[announced.length - 1]!.eventAt! : "Retorno não informado",
    entryIsClearance: false,
    layoffIsInjury: false,
  };
}

export function marketFlags(decimal: number | null, field: number[], won: boolean, placed: boolean, rule = LONGSHOT_RULE) {
  const priced = field.filter((value) => value > 1);
  const min = priced.length ? Math.min(...priced) : null;
  const co = min == null ? [] : priced.filter((value) => value <= min * 1.05);
  const favourite = decimal != null && min != null && decimal === min && co.length === 1;
  const coFavourite = decimal != null && min != null && co.length > 1 && decimal <= min * 1.05;
  const longshot = decimal != null && decimal >= rule.minDecimal;
  return {
    longshot,
    favourite,
    coFavourite,
    historicalSurprise: Boolean(won && longshot),
    placed,
    unpriced: decimal == null || !(decimal > 1),
  };
}

export function longshotRecord(
  starts: { started: boolean; decimal: number | null; won: boolean; placed: boolean; field: number[] }[],
  rule = LONGSHOT_RULE,
) {
  let eligible = 0;
  let wins = 0;
  let places = 0;
  let uncovered = 0;
  let favouriteRuns = 0;
  let favouriteWins = 0;
  for (const start of starts) {
    if (!start.started) continue;
    const flags = marketFlags(start.decimal, start.field, start.won, start.placed, rule);
    if (flags.unpriced) {
      uncovered += 1;
      continue;
    }
    if (flags.longshot) {
      eligible += 1;
      if (start.won) wins += 1;
      if (start.placed) places += 1;
    }
    if (flags.favourite) {
      favouriteRuns += 1;
      if (start.won) favouriteWins += 1;
    }
  }
  return {
    rule: rule.version,
    minDecimal: rule.minDecimal,
    note: rule.note,
    wins,
    places,
    eligible,
    rate: eligible === 0 ? null : wins / eligible,
    uncovered,
    favouriteRuns,
    favouriteWins,
    label: eligible === 0 ? "sem preço elegível" : `${wins}/${eligible}`,
  };
}

export function featuresAt(
  priors: PriorRun[],
  cutoffIso: string,
  current: { jockeyKey: string | null; trainerKey: string | null; course: string | null; distanceM: number | null; going: string | null; preoff: number | null },
): Record<string, number | null> {
  const cut = Date.parse(cutoffIso);
  const past = priors.filter((prior) => Date.parse(prior.offAt) < cut && prior.started);
  const window = (days: number) => past.filter((prior) => cut - Date.parse(prior.offAt) <= days * 86_400_000);
  const wins = (rows: PriorRun[]) => rows.filter((prior) => prior.position === 1).length;
  const last = [...past].sort((a, b) => Date.parse(b.offAt) - Date.parse(a.offAt))[0];
  const daysSince = last ? (cut - Date.parse(last.offAt)) / 86_400_000 : null;
  const withJockey = past.filter((prior) => current.jockeyKey && prior.jockeyKey === current.jockeyKey);
  const withTrainer = past.filter((prior) => current.trainerKey && prior.trainerKey === current.trainerKey);
  const values: Record<string, number | null> = {
    prior_runs: past.length,
    prior_wins: wins(past),
    days_since_run: daysSince,
    runs_14d: window(14).length,
    wins_14d: wins(window(14)),
    runs_30d: window(30).length,
    wins_30d: wins(window(30)),
    runs_90d: window(90).length,
    wins_90d: wins(window(90)),
    layoff_days: daysSince,
    horse_jockey_runs: withJockey.length,
    horse_jockey_wins: wins(withJockey),
    horse_trainer_runs: withTrainer.length,
    horse_trainer_wins: wins(withTrainer),
    same_course_runs: past.filter((prior) => current.course && prior.course === current.course).length,
    same_distance_runs: past.filter((prior) => current.distanceM != null && prior.distanceM === current.distanceM).length,
    same_going_runs: past.filter((prior) => current.going && prior.going === current.going).length,
    implied_prob: current.preoff != null && current.preoff > 1 ? 1 / current.preoff : null,
  };
  for (const key of Object.keys(values)) {
    if (!FEATURE_ALLOW.has(key)) delete values[key];
  }
  return values;
}

export function featureAllowList(): string[] {
  return [...FEATURE_ALLOW];
}

export type RaceFold = { id: string; offAt: string; runners: string[] };

export function foldWholeRaces(races: RaceFold[], trainEnd: string, testStart: string) {
  const folds = assignFolds(races, trainEnd, testStart);
  const home = new Map<string, string>();
  for (const [name, rows] of Object.entries(folds) as [string, RaceFold[]][]) {
    for (const race of rows) {
      if (home.has(race.id)) throw new Error("A mesma corrida entrou em duas partições.");
      home.set(race.id, name);
    }
  }
  return folds;
}

export type Logistic = { w: number[]; b: number; mean: number[]; scale: number[]; family: "logistic-gd"; status: "experimental" };

function sigmoid(z: number): number {
  const clipped = Math.max(-20, Math.min(20, z));
  return 1 / (1 + Math.exp(-clipped));
}

export function fitLogistic(raw: number[][], y: number[], epochs = 80, lr = 0.05): Logistic {
  if (raw.length === 0 || raw.length !== y.length) throw new Error("Treino vazio ou desalinhado.");
  const width = raw[0]!.length;
  const mean = Array(width).fill(0);
  for (const row of raw) for (let j = 0; j < width; j += 1) mean[j] += row[j] ?? 0;
  for (let j = 0; j < width; j += 1) mean[j] /= raw.length;
  const scale = Array(width).fill(0);
  for (const row of raw) for (let j = 0; j < width; j += 1) scale[j] += ((row[j] ?? 0) - mean[j]) ** 2;
  for (let j = 0; j < width; j += 1) scale[j] = Math.sqrt(scale[j] / raw.length) || 1;
  const x = raw.map((row) => row.map((value, j) => ((value ?? 0) - mean[j]) / scale[j]));
  const w = Array(width).fill(0);
  let b = 0;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (let i = 0; i < x.length; i += 1) {
      let z = b;
      for (let j = 0; j < width; j += 1) z += w[j] * x[i]![j]!;
      const error = sigmoid(z) - y[i]!;
      for (let j = 0; j < width; j += 1) w[j] -= lr * error * x[i]![j]!;
      b -= lr * error;
    }
  }
  return { w, b, mean, scale, family: "logistic-gd", status: "experimental" };
}

export function predictLogistic(model: Logistic, raw: number[]): number {
  let z = model.b;
  for (let j = 0; j < model.w.length; j += 1) {
    z += model.w[j]! * (((raw[j] ?? 0) - model.mean[j]!) / model.scale[j]!);
  }
  return sigmoid(z);
}

export function binaryScores(pairs: { p: number; y: number }[]): { logloss: number | null; brier: number | null; n: number; brierScale: string } {
  if (pairs.length === 0) return { logloss: null, brier: null, n: 0, brierScale: "Brier binário entre 0 e 1, por participante. Não é o Brier multiclasse do lote." };
  let loss = 0;
  let brier = 0;
  for (const pair of pairs) {
    const p = Math.min(1 - 1e-6, Math.max(1e-6, pair.p));
    loss += -(pair.y * Math.log(p) + (1 - pair.y) * Math.log(1 - p));
    brier += (p - pair.y) ** 2;
  }
  return {
    logloss: loss / pairs.length,
    brier: brier / pairs.length,
    n: pairs.length,
    brierScale: "Brier binário entre 0 e 1, por participante. Não é o Brier multiclasse do lote.",
  };
}

export function promotionDecision(input: { prospectivePass: boolean; testN: number }): { ok: boolean; status: "experimental" | "promoted"; reason: string } {
  if (!input.prospectivePass) {
    return { ok: false, status: "experimental", reason: "Sem validação prospectiva. O treino não promove o modelo." };
  }
  if (input.testN < 1) return { ok: false, status: "experimental", reason: "O teste final está vazio." };
  return { ok: true, status: "promoted", reason: "Validação prospectiva registada fora deste treino automático." };
}

export function combineProfits(rows: { currency: string; profit: number }[]): { ok: true; currency: string | null; profit: number; n: number } | { ok: false; reason: string } {
  const codes = new Set(rows.map((row) => row.currency));
  if (codes.size > 1) return { ok: false, reason: "Moedas diferentes. Sem conversão datada não há soma." };
  return { ok: true, currency: [...codes][0] ?? null, profit: rows.reduce((sum, row) => sum + row.profit, 0), n: rows.length };
}

export function vectorFrom(features: Record<string, number | null>, keys: string[]): number[] {
  return keys.map((key) => features[key] ?? 0);
}

export function rateRows(rows: { label: string; started: boolean; won: boolean }[]): { label: string; runs: number; wins: number; rate: number | null }[] {
  const groups = new Map<string, { runs: number; wins: number }>();
  for (const row of rows) {
    if (!row.started) continue;
    const slot = groups.get(row.label) ?? { runs: 0, wins: 0 };
    slot.runs += 1;
    if (row.won) slot.wins += 1;
    groups.set(row.label, slot);
  }
  return [...groups.entries()].map(([label, slot]) => ({
    label,
    runs: slot.runs,
    wins: slot.wins,
    rate: slot.runs === 0 ? null : slot.wins / slot.runs,
  }));
}

export function distanceBand(meters: number | null): string {
  if (meters == null) return "distância não informada";
  if (meters < 1600) return "até 1600 m";
  if (meters < 2400) return "1600–2399 m";
  if (meters < 3200) return "2400–3199 m";
  return "3200 m ou mais";
}

export function runsAfterReturn(
  runs: { offAt: string; started: boolean; position: number | null; race: string }[],
  returnAt: string | null,
): { announced: boolean; label: string; next: { race: string; offAt: string; position: number | null }[] } {
  if (!returnAt) return { announced: false, label: "Retorno não informado", next: [] };
  const cut = Date.parse(returnAt);
  if (Number.isNaN(cut)) return { announced: false, label: "Retorno não informado", next: [] };
  const next = runs
    .filter((run) => run.started && Date.parse(run.offAt) >= cut)
    .sort((a, b) => Date.parse(a.offAt) - Date.parse(b.offAt))
    .slice(0, 3)
    .map((run) => ({ race: run.race, offAt: run.offAt, position: run.position }));
  return { announced: true, label: returnAt, next };
}

export function reliabilityBins(pairs: { p: number; y: number }[], bins = 5): { lo: number; hi: number; n: number; meanP: number | null; observed: number | null }[] {
  const width = 1 / bins;
  const buckets = Array.from({ length: bins }, (_, index) => ({ lo: index * width, hi: (index + 1) * width, n: 0, wins: 0, pSum: 0 }));
  for (const pair of pairs) {
    const index = Math.min(bins - 1, Math.max(0, Math.floor(Math.min(pair.p, 0.999999) / width)));
    const bucket = buckets[index]!;
    bucket.n += 1;
    bucket.wins += pair.y;
    bucket.pSum += pair.p;
  }
  return buckets.map((bucket) => ({
    lo: bucket.lo,
    hi: bucket.hi,
    n: bucket.n,
    meanP: bucket.n ? bucket.pSum / bucket.n : null,
    observed: bucket.n ? bucket.wins / bucket.n : null,
  }));
}

export function withoutMarket(keys: string[], row: number[]): { keys: string[]; row: number[] } {
  const nextKeys: string[] = [];
  const nextRow: number[] = [];
  keys.forEach((key, index) => {
    if (key === "implied_prob") return;
    nextKeys.push(key);
    nextRow.push(row[index] ?? 0);
  });
  return { keys: nextKeys, row: nextRow };
}
