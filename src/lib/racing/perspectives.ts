/**
 * Five rule perspectives. They are not separate models.
 * Agreement between them does not raise a probability.
 * Operational thresholds are configuration, not a statistical proof.
 */

export const RULES_VERSION = "rules-1";

export const RULES = {
  version: RULES_VERSION,
  market: { minCoverage: 0.8, maxAgeMs: 15 * 60 * 1000, coFavouriteRatio: 1.05 },
  stable: { minTrainerRuns: 8, minJockeyRuns: 8 },
  weight: { lbPerPoint: 0.45, minRated: 3 },
} as const;

export type PerspectiveId = "forma" | "pista" | "mercado" | "estabulo" | "peso";

export type Stance = "alinha" | "discorda" | "abstem";

export type FormToken =
  | { raw: string; kind: "place"; place: number }
  | { raw: string; kind: "incident" }
  | { raw: string; kind: "unknown" };

export type GoingRun = {
  offAt: string;
  going?: string;
  course?: string;
  distance?: string;
  position: number | null;
};

export type StableSample = {
  runs: number;
  wins: number;
  asOf: string;
  source: string;
};

export type PricePoint = {
  book: string;
  market: "WIN";
  decimal: number;
  observedAt: string | null;
  receivedAt: string;
};

export type RunnerView = {
  key: string;
  name: string;
  cloth: number;
  form: string;
  goingRuns: GoingRun[];
  trainer: StableSample | null;
  jockey: StableSample | null;
  or: number | null;
  weightLb: number | null;
  price: PricePoint | null;
};

export type RaceView = {
  offAt: string;
  now: string;
  going: string;
  course: string;
  distance: string;
  handicap: boolean;
  handicapEvidence: "declared" | "none";
  runners: RunnerView[];
  pickKey: string | null;
};

export type PerspectiveRead = {
  id: PerspectiveId;
  version: string;
  horseKey: string | null;
  horse: string | null;
  stance: Stance;
  note: string;
};

const INCIDENTS = new Set(["F", "U", "P", "R", "B", "S", "C", "D"]);

/** UK-style figures: the rightmost token is the most recent run. */
export function parseForm(form: string): FormToken[] {
  const tokens: FormToken[] = [];
  for (const raw of form.toUpperCase().replace(/[^0-9A-Z]/g, "")) {
    if (raw >= "1" && raw <= "9") tokens.push({ raw, kind: "place", place: Number(raw) });
    else if (raw === "0") tokens.push({ raw, kind: "place", place: 10 });
    else if (INCIDENTS.has(raw)) tokens.push({ raw, kind: "incident" });
    else tokens.push({ raw, kind: "unknown" });
  }
  return tokens;
}

function formScore(tokens: FormToken[]): number | null {
  if (tokens.length === 0) return null;
  let score = 0;
  let weight = 1;
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i]!;
    const pts =
      token.kind === "place"
        ? token.place === 1
          ? 8
          : token.place === 2
            ? 5
            : token.place === 3
              ? 3
              : token.place <= 5
                ? 1
                : 0
        : 0;
    score += pts * weight;
    weight *= 0.55;
  }
  return score;
}

function stance(pickKey: string | null, horseKey: string | null): Stance {
  if (!horseKey) return "abstem";
  if (!pickKey) return "discorda";
  return horseKey === pickKey ? "alinha" : "discorda";
}

function uniqueBest(
  rows: { key: string; name: string; score: number }[],
): { key: string; name: string } | "tie" | "none" {
  if (rows.length === 0) return "none";
  const top = Math.max(...rows.map((row) => row.score));
  const best = rows.filter((row) => Math.abs(row.score - top) < 1e-9);
  if (best.length !== 1) return "tie";
  return best[0]!;
}

function read(id: PerspectiveId, pickKey: string | null, horse: { key: string; name: string } | null, note: string): PerspectiveRead {
  return {
    id,
    version: RULES.version,
    horseKey: horse?.key ?? null,
    horse: horse?.name ?? null,
    stance: stance(pickKey, horse?.key ?? null),
    note,
  };
}

export function readForma(race: RaceView): PerspectiveRead {
  const scored = race.runners.flatMap((runner) => {
    const score = formScore(parseForm(runner.form));
    return score == null ? [] : [{ key: runner.key, name: runner.name, score }];
  });
  const best = uniqueBest(scored);
  if (best === "none") {
    return read("forma", race.pickKey, null, "Sem figuras. Quedas, abandonos e estreias sem histórico não recebem um lugar inventado.");
  }
  if (best === "tie") {
    return read("forma", race.pickKey, null, "Figuras empatadas. A forma não desempata e abstém-se.");
  }
  return read(
    "forma",
    race.pickKey,
    best,
    "Figuras da esquerda para a direita, a mais recente à direita. 0 é fora dos nove primeiros. F, U, P, R, B, S, C e D não contam como lugar.",
  );
}

function samePlace(run: GoingRun, race: RaceView): boolean {
  const going = run.going?.toLowerCase();
  const wanted = race.going.toLowerCase();
  return (
    (going != null && going.length > 0 && (going === wanted || wanted.includes(going) || going.includes(wanted))) ||
    (run.course != null && run.course.toLowerCase() === race.course.toLowerCase()) ||
    (run.distance != null && run.distance.toLowerCase() === race.distance.toLowerCase())
  );
}

export function readPista(race: RaceView): PerspectiveRead {
  const off = Date.parse(race.offAt);
  const scored = race.runners.flatMap((runner) => {
    const prior = runner.goingRuns.filter((run) => Date.parse(run.offAt) < off && samePlace(run, race));
    if (prior.length === 0) return [];
    const score =
      prior.reduce((acc, run) => acc + (run.position === 1 ? 3 : run.position != null && run.position <= 3 ? 1 : 0), 0) /
      prior.length;
    return [{ key: runner.key, name: runner.name, score }];
  });
  const best = uniqueBest(scored);
  if (best === "none") {
    return read("pista", race.pickKey, null, "Sem corridas anteriores neste piso, hipódromo ou distância. A forma geral não chega.");
  }
  if (best === "tie") return read("pista", race.pickKey, null, "Histórico de pista empatado. Abstenção.");
  return read("pista", race.pickKey, best, "Só entram corridas anteriores no mesmo piso, hipódromo ou distância, com hora anterior à largada.");
}

export function readMercado(race: RaceView): PerspectiveRead {
  const now = Date.parse(race.now);
  const off = Date.parse(race.offAt);
  const active = race.runners;
  const usable = active.flatMap((runner) => {
    const price = runner.price;
    if (!price || price.market !== "WIN" || price.observedAt == null) return [];
    const observed = Date.parse(price.observedAt);
    if (Number.isNaN(observed) || observed > now || observed >= off) return [];
    if (now - observed > RULES.market.maxAgeMs) return [];
    return [{ runner, price }];
  });
  if (usable.length / active.length < RULES.market.minCoverage) {
    return read("mercado", race.pickKey, null, "Mercado incompleto ou cotação sem hora de observação. Receber o preço agora não o torna recente.");
  }
  const books = new Set(usable.map((row) => row.price.book));
  if (books.size !== 1) {
    return read("mercado", race.pickKey, null, "Os preços utilizáveis não são todos da mesma casa. Não misturo livros.");
  }
  const ranked = [...usable].sort((a, b) => a.price.decimal - b.price.decimal || a.runner.cloth - b.runner.cloth);
  const first = ranked[0]!;
  const second = ranked[1];
  if (second && second.price.decimal / first.price.decimal < RULES.market.coFavouriteRatio) {
    return read("mercado", race.pickKey, null, "Cofavoritos. A casa não separa um favorito e a perspectiva abstém-se.");
  }
  return read(
    "mercado",
    race.pickKey,
    { key: first.runner.key, name: first.runner.name },
    `Favorito WIN de ${first.price.book}, observado ${first.price.observedAt}. A hora de recepção não substitui a hora observada.`,
  );
}

export function readEstabulo(race: RaceView): PerspectiveRead {
  const off = Date.parse(race.offAt);
  const scored = race.runners.flatMap((runner) => {
    const trainer = runner.trainer;
    if (!trainer || !trainer.source.trim() || Date.parse(trainer.asOf) >= off) return [];
    if (trainer.runs < RULES.stable.minTrainerRuns) return [];
    const jockey =
      runner.jockey &&
      runner.jockey.source.trim() &&
      Date.parse(runner.jockey.asOf) < off &&
      runner.jockey.runs >= RULES.stable.minJockeyRuns
        ? runner.jockey.wins / runner.jockey.runs
        : null;
    const score = trainer.wins / trainer.runs * 0.7 + (jockey ?? trainer.wins / trainer.runs) * 0.3;
    return [{ key: runner.key, name: runner.name, score }];
  });
  const best = uniqueBest(scored);
  if (best === "none") {
    return read(
      "estabulo",
      race.pickKey,
      null,
      `Sem amostra anterior do treinador (mínimo operacional ${RULES.stable.minTrainerRuns}), com fonte e hora anteriores à largada.`,
    );
  }
  if (best === "tie") return read("estabulo", race.pickKey, null, "Estábulo empatado. Abstenção.");
  return read("estabulo", race.pickKey, best, "Histórico anterior do treinador e, quando existe, do jóquei. O mínimo é um controlo operacional, não uma prova.");
}

export function readPeso(race: RaceView): PerspectiveRead {
  if (!race.handicap || race.handicapEvidence !== "declared") {
    return read("peso", race.pickKey, null, "Não é um handicap declarado. O título da corrida, sozinho, não chega.");
  }
  const rated = race.runners.filter((runner) => runner.or != null && runner.weightLb != null);
  if (rated.length < RULES.weight.minRated) {
    return read("peso", race.pickKey, null, "Handicap sem rating e peso em libras para comparar.");
  }
  const scored = rated.map((runner) => ({
    key: runner.key,
    name: runner.name,
    score: (runner.or as number) - RULES.weight.lbPerPoint * (runner.weightLb as number),
  }));
  const best = uniqueBest(scored);
  if (best === "tie" || best === "none") {
    return read("peso", race.pickKey, null, "Balanço de peso empatado ou vazio. Abstenção.");
  }
  return read(
    "peso",
    race.pickKey,
    best,
    `Hipótese operacional não validada: OR − ${RULES.weight.lbPerPoint} × libras. Não é um modelo de peso. Allowances não declarados ficam de fora.`,
  );
}

export function readPerspectives(race: RaceView): PerspectiveRead[] {
  return [readForma(race), readPista(race), readMercado(race), readEstabulo(race), readPeso(race)];
}
