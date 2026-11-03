export type ImportedPrice = {
  runnerKey: string;
  market: "WIN";
  book: string;
  decimal: number;
  observedAt: string | null;
  providerUpdatedAt: string | null;
  source: "user";
};

export type ImportedGoingRun = {
  offAt: string;
  going: string | null;
  course: string | null;
  distance: string | null;
  position: number | null;
};

export type ImportedStable = {
  runs: number;
  wins: number;
  asOf: string;
  source: string;
};

export type ImportedRunner = {
  providerRunnerId: string | null;
  horseKey: string | null;
  name: string;
  cloth: number | null;
  jockey: string | null;
  jockeyKey: string | null;
  trainer: string | null;
  trainerKey: string | null;
  form: string | null;
  weightLb: number | null;
  or: number | null;
  goingRuns: ImportedGoingRun[];
  trainerHistory: ImportedStable | null;
  jockeyHistory: ImportedStable | null;
};

export type ImportedRace = {
  providerRaceId: string | null;
  course: string;
  country: string;
  discipline: string;
  name: string;
  distance: string | null;
  going: string | null;
  offAt: string;
  handicap: boolean;
  origin: "user";
  runners: ImportedRunner[];
  prices: ImportedPrice[];
};

export type ImportIssue = { path: string; message: string };

const DISCIPLINES = new Set(["Hurdle", "Chase", "Flat", "Bumper"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseStable(value: unknown, path: string, errors: ImportIssue[]): ImportedStable | null {
  if (value == null) return null;
  if (!isObject(value)) {
    errors.push({ path, message: "Histórico de estábulo inválido." });
    return null;
  }
  const asOf = str(value.asOf);
  const source = str(value.source);
  const runs = value.runs;
  const wins = value.wins;
  if (
    typeof runs !== "number" ||
    !Number.isInteger(runs) ||
    runs < 0 ||
    typeof wins !== "number" ||
    !Number.isInteger(wins) ||
    wins < 0 ||
    wins > runs ||
    !asOf ||
    Number.isNaN(Date.parse(asOf)) ||
    !source
  ) {
    errors.push({ path, message: "Estábulo precisa de runs, wins, asOf e source anteriores à largada. Sem isto, a perspectiva abstém." });
    return null;
  }
  return { runs, wins, asOf: new Date(asOf).toISOString(), source };
}

function parseGoingRuns(value: unknown, path: string, errors: ImportIssue[]): ImportedGoingRun[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    errors.push({ path, message: "goingRuns tem de ser uma lista. A forma geral não a substitui." });
    return [];
  }
  const runs: ImportedGoingRun[] = [];
  value.forEach((raw, index) => {
    if (!isObject(raw)) {
      errors.push({ path: `${path}[${index}]`, message: "Corrida anterior inválida." });
      return;
    }
    const offAt = str(raw.offAt);
    if (!offAt || Number.isNaN(Date.parse(offAt))) {
      errors.push({ path: `${path}[${index}]`, message: "Cada corrida anterior precisa de offAt." });
      return;
    }
    const position = raw.position == null ? null : raw.position;
    if (position != null && (typeof position !== "number" || !Number.isInteger(position) || position < 1)) {
      errors.push({ path: `${path}[${index}]`, message: "A posição anterior tem de ser um inteiro ou ficar vazia." });
      return;
    }
    runs.push({
      offAt: new Date(offAt).toISOString(),
      going: str(raw.going),
      course: str(raw.course),
      distance: str(raw.distance),
      position,
    });
  });
  return runs;
}

export function parseImport(value: unknown): { races: ImportedRace[] } | { errors: ImportIssue[] } {
  if (!isObject(value) || !Array.isArray(value.races)) {
    return { errors: [{ path: "races", message: "O ficheiro precisa de uma lista races." }] };
  }
  if (value.origin === "synthetic" || value.races.some((race) => isObject(race) && race.origin === "synthetic")) {
    return { errors: [{ path: "origin", message: "Dados fictícios não entram no livro." }] };
  }
  const errors: ImportIssue[] = [];
  const races: ImportedRace[] = [];
  value.races.forEach((raw, index) => {
    const path = `races[${index}]`;
    if (!isObject(raw)) {
      errors.push({ path, message: "Corrida inválida." });
      return;
    }
    const course = str(raw.course);
    const country = str(raw.country);
    const discipline = str(raw.discipline);
    const name = str(raw.name);
    const offAt = str(raw.offAt);
    if (!course || !country || !name || !offAt || Number.isNaN(Date.parse(offAt))) {
      errors.push({ path, message: "course, country, name e offAt em UTC são obrigatórios." });
      return;
    }
    if (!discipline || !DISCIPLINES.has(discipline)) {
      errors.push({ path, message: "discipline tem de ser Hurdle, Chase, Flat ou Bumper." });
      return;
    }
    if (!Array.isArray(raw.runners) || raw.runners.length === 0) {
      errors.push({ path, message: "A corrida precisa de participantes." });
      return;
    }
    const runners: ImportedRunner[] = [];
    raw.runners.forEach((runnerRaw, runnerIndex) => {
      if (!isObject(runnerRaw) || !str(runnerRaw.name)) {
        errors.push({ path: `${path}.runners[${runnerIndex}]`, message: "Cada participante precisa de nome. Nomes iguais não são fundidos." });
        return;
      }
      runners.push({
        providerRunnerId: str(runnerRaw.providerRunnerId),
        horseKey: str(runnerRaw.horseKey),
        name: str(runnerRaw.name)!,
        cloth: typeof runnerRaw.cloth === "number" ? runnerRaw.cloth : null,
        jockey: str(runnerRaw.jockey),
        jockeyKey: str(runnerRaw.jockeyKey),
        trainer: str(runnerRaw.trainer),
        trainerKey: str(runnerRaw.trainerKey),
        form: typeof runnerRaw.form === "string" ? runnerRaw.form : null,
        weightLb: typeof runnerRaw.weightLb === "number" ? runnerRaw.weightLb : null,
        or: typeof runnerRaw.or === "number" ? runnerRaw.or : null,
        goingRuns: parseGoingRuns(runnerRaw.goingRuns, `${path}.runners[${runnerIndex}].goingRuns`, errors),
        trainerHistory: parseStable(runnerRaw.trainerHistory, `${path}.runners[${runnerIndex}].trainerHistory`, errors),
        jockeyHistory: parseStable(runnerRaw.jockeyHistory, `${path}.runners[${runnerIndex}].jockeyHistory`, errors),
      });
    });
    const prices: ImportedPrice[] = [];
    if (raw.prices != null) {
      if (!Array.isArray(raw.prices)) {
        errors.push({ path: `${path}.prices`, message: "prices tem de ser uma lista." });
        return;
      }
      raw.prices.forEach((priceRaw, priceIndex) => {
        if (!isObject(priceRaw) || !str(priceRaw.runnerKey) || !str(priceRaw.book) || priceRaw.market !== "WIN") {
          errors.push({ path: `${path}.prices[${priceIndex}]`, message: "Preço WIN precisa de runnerKey, book e market." });
          return;
        }
        if (typeof priceRaw.decimal !== "number" || !(priceRaw.decimal > 1)) {
          errors.push({ path: `${path}.prices[${priceIndex}]`, message: "A odd decimal tem de ser maior do que 1." });
          return;
        }
        const observedAt = priceRaw.observedAt == null ? null : str(priceRaw.observedAt);
        if (priceRaw.observedAt != null && (observedAt == null || Number.isNaN(Date.parse(observedAt)))) {
          errors.push({ path: `${path}.prices[${priceIndex}]`, message: "observedAt inválido. A hora de recepção não o substitui." });
          return;
        }
        prices.push({
          runnerKey: str(priceRaw.runnerKey)!,
          market: "WIN",
          book: str(priceRaw.book)!,
          decimal: priceRaw.decimal,
          observedAt,
          providerUpdatedAt: priceRaw.providerUpdatedAt == null ? null : str(priceRaw.providerUpdatedAt),
          source: "user",
        });
      });
    }
    races.push({
      providerRaceId: str(raw.providerRaceId),
      course,
      country,
      discipline,
      name,
      distance: str(raw.distance),
      going: str(raw.going),
      offAt: new Date(offAt).toISOString(),
      handicap: raw.handicap === true,
      origin: "user",
      runners,
      prices,
    });
  });
  if (errors.length) return { errors };
  return { races };
}

export function parseCsv(text: string): { races: ImportedRace[] } | { errors: ImportIssue[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { errors: [{ path: "csv", message: "CSV vazio." }] };
  const header = lines[0]!.split(",").map((cell) => cell.trim());
  const need = ["race_id", "course", "country", "off_at", "discipline", "name", "horse", "decimal", "book"];
  if (need.some((column) => !header.includes(column))) {
    return { errors: [{ path: "csv", message: `Cabeçalho em falta. Precisa de ${need.join(", ")}.` }] };
  }
  const index = Object.fromEntries(header.map((column, i) => [column, i]));
  const grouped = new Map<string, Record<string, unknown>>();
  for (const line of lines.slice(1)) {
    const cells = line.split(",").map((cell) => cell.trim());
    const raceId = cells[index.race_id] ?? "";
    if (!raceId) return { errors: [{ path: "csv", message: "race_id vazio." }] };
    const race = grouped.get(raceId) ?? {
      providerRaceId: raceId,
      course: cells[index.course],
      country: cells[index.country],
      discipline: cells[index.discipline],
      name: cells[index.name],
      offAt: cells[index.off_at],
      handicap: false,
      runners: [],
      prices: [],
    };
    const runners = race.runners as Record<string, unknown>[];
    const horse = cells[index.horse] ?? "";
    if (!runners.some((runner) => runner.name === horse && runner.horseKey === horse)) {
      runners.push({ name: horse, horseKey: horse, providerRunnerId: horse });
    }
    const decimal = Number(cells[index.decimal]);
    (race.prices as Record<string, unknown>[]).push({
      runnerKey: horse,
      market: "WIN",
      book: cells[index.book],
      decimal,
      observedAt: index.observed_at != null ? cells[index.observed_at] || null : null,
    });
    grouped.set(raceId, race);
  }
  return parseImport({ races: [...grouped.values()] });
}
