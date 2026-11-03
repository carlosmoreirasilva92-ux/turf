import { parseHistoryPack, type Issue } from "./import-pack.ts";

const SECTIONS: Record<string, string[]> = {
  origin: ["value"],
  sources: ["key", "name", "kind"],
  entities: ["kind", "key", "name", "country", "sex", "foaledYear"],
  aliases: ["kind", "entityKey", "alias"],
  links: ["horseKey", "role", "otherKey"],
  courses: ["key", "name", "country"],
  races: ["key", "courseKey", "name", "country", "discipline", "offAt", "distanceM", "going", "surface", "raceClass", "weatherForecast", "weatherObserved", "status"],
  runners: ["raceKey", "horseKey", "jockeyKey", "trainerKey", "cloth", "draw", "carriedLb", "bodyKg", "officialRating", "providerRating", "ownMetric", "started", "position", "deadHeat", "finishStatus", "comment"],
  prices: ["raceKey", "horseKey", "book", "market", "decimal", "kind", "observedAt", "currency"],
  incidents: ["horseKey", "raceKey", "kind", "code", "jurisdiction", "obstacle", "description", "publishedCause", "inquiry", "examNote", "factAt"],
  episodes: ["key", "horseKey", "documentedReason"],
  events: ["episodeKey", "kind", "eventAt", "note"],
  observations: ["horseKey", "attr", "valueNum", "valueText", "unit", "observedAt"],
  workouts: ["horseKey", "workedAt", "course", "distanceM", "timeSec", "surface", "going", "restricted"],
  facts: ["subjectType", "subjectKey", "attr", "value", "unit", "observedAt", "absenceReason"],
  absences: ["subjectType", "subjectKey", "attr", "reason"],
};

function parseLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function blank(value: string | undefined): string | null {
  const text = value?.trim() ?? "";
  return text ? text : null;
}

function numeric(value: string | undefined, path: string, errors: Issue[]): number | null {
  const text = blank(value);
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    errors.push({ path, message: `Número inválido em ${path}.` });
    return null;
  }
  return parsed;
}

function flag(value: string | undefined): boolean {
  return blank(value)?.toLowerCase() === "true";
}

export function parseHistoryCsv(text: string): ReturnType<typeof parseHistoryPack> {
  const errors: Issue[] = [];
  const tables = new Map<string, Record<string, string>[]>();
  let section = "";
  let header: string[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (const [lineNo, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      section = line.slice(1).trim();
      header = [];
      if (!SECTIONS[section]) errors.push({ path: `line ${lineNo + 1}`, message: `Secção CSV não cadastrada: ${section}. Não foi descartada em silêncio.` });
      continue;
    }
    if (!section || !SECTIONS[section]) continue;
    const cells = parseLine(line);
    if (header.length === 0) {
      const expected = SECTIONS[section]!;
      if (cells.join(",") !== expected.join(",")) {
        errors.push({ path: section, message: `Cabeçalho de ${section} tem de ser ${expected.join(",")}.` });
      }
      header = cells;
      continue;
    }
    const row: Record<string, string> = {};
    header.forEach((key, index) => {
      row[key] = cells[index] ?? "";
    });
    const list = tables.get(section) ?? [];
    list.push(row);
    tables.set(section, list);
  }
  if (errors.length) return { errors };

  const originCell = tables.get("origin")?.[0]?.value?.trim();
  const origin = originCell || "user";
  const runnersByRace = new Map<string, Record<string, unknown>[]>();
  for (const row of tables.get("runners") ?? []) {
    const raceKey = blank(row.raceKey);
    const horseKey = blank(row.horseKey);
    if (!raceKey || !horseKey) {
      errors.push({ path: "runners", message: "Cada participante precisa de raceKey e horseKey." });
      continue;
    }
    const list = runnersByRace.get(raceKey) ?? [];
    list.push({
      horseKey,
      jockeyKey: blank(row.jockeyKey),
      trainerKey: blank(row.trainerKey),
      cloth: numeric(row.cloth, "runners.cloth", errors),
      draw: numeric(row.draw, "runners.draw", errors),
      carriedLb: numeric(row.carriedLb, "runners.carriedLb", errors),
      bodyKg: numeric(row.bodyKg, "runners.bodyKg", errors),
      officialRating: numeric(row.officialRating, "runners.officialRating", errors),
      providerRating: numeric(row.providerRating, "runners.providerRating", errors),
      ownMetric: numeric(row.ownMetric, "runners.ownMetric", errors),
      started: blank(row.started)?.toLowerCase() !== "false",
      position: numeric(row.position, "runners.position", errors),
      deadHeat: flag(row.deadHeat),
      finishStatus: blank(row.finishStatus),
      comment: blank(row.comment),
      prices: [] as Record<string, unknown>[],
    });
    runnersByRace.set(raceKey, list);
  }
  for (const row of tables.get("prices") ?? []) {
    const raceKey = blank(row.raceKey);
    const horseKey = blank(row.horseKey);
    const runners = raceKey ? runnersByRace.get(raceKey) : undefined;
    const runner = runners?.find((item) => item.horseKey === horseKey);
    if (!runner) {
      errors.push({ path: "prices", message: `Preço sem participante ${horseKey ?? "?"} na corrida ${raceKey ?? "?"}.` });
      continue;
    }
    (runner.prices as Record<string, unknown>[]).push({
      book: blank(row.book),
      market: blank(row.market),
      decimal: numeric(row.decimal, "prices.decimal", errors),
      kind: blank(row.kind),
      observedAt: blank(row.observedAt),
      currency: blank(row.currency),
    });
  }
  const eventsByEpisode = new Map<string, Record<string, unknown>[]>();
  for (const row of tables.get("events") ?? []) {
    const key = blank(row.episodeKey);
    if (!key) {
      errors.push({ path: "events", message: "Evento de recuperação sem episodeKey." });
      continue;
    }
    const list = eventsByEpisode.get(key) ?? [];
    list.push({ kind: blank(row.kind), eventAt: blank(row.eventAt), note: blank(row.note) });
    eventsByEpisode.set(key, list);
  }
  const episodeKeys = new Set((tables.get("episodes") ?? []).map((row) => blank(row.key)));
  for (const key of eventsByEpisode.keys()) {
    if (!episodeKeys.has(key)) errors.push({ path: "events", message: `Evento sem episódio ${key}.` });
  }
  const raceKeys = new Set((tables.get("races") ?? []).map((row) => blank(row.key)));
  for (const key of runnersByRace.keys()) {
    if (!raceKeys.has(key)) errors.push({ path: "runners", message: `Participantes sem corrida ${key}. Não foram descartados em silêncio.` });
  }
  if (errors.length) return { errors };

  const body = {
    origin,
    sources: (tables.get("sources") ?? []).map((row) => ({ key: blank(row.key), name: blank(row.name), kind: blank(row.kind) })),
    entities: (tables.get("entities") ?? []).map((row) => ({
      kind: blank(row.kind),
      key: blank(row.key),
      name: blank(row.name),
      country: blank(row.country),
      sex: blank(row.sex),
      foaledYear: numeric(row.foaledYear, "entities.foaledYear", errors),
    })),
    aliases: (tables.get("aliases") ?? []).map((row) => ({ kind: blank(row.kind), entityKey: blank(row.entityKey), alias: blank(row.alias) })),
    links: (tables.get("links") ?? []).map((row) => ({ horseKey: blank(row.horseKey), role: blank(row.role), otherKey: blank(row.otherKey) })),
    courses: (tables.get("courses") ?? []).map((row) => ({ key: blank(row.key), name: blank(row.name), country: blank(row.country) })),
    races: (tables.get("races") ?? []).map((row) => ({
      key: blank(row.key),
      courseKey: blank(row.courseKey),
      name: blank(row.name),
      country: blank(row.country),
      discipline: blank(row.discipline),
      offAt: blank(row.offAt),
      distanceM: numeric(row.distanceM, "races.distanceM", errors),
      going: blank(row.going),
      surface: blank(row.surface),
      raceClass: blank(row.raceClass),
      weatherForecast: blank(row.weatherForecast),
      weatherObserved: blank(row.weatherObserved),
      status: blank(row.status),
      runners: runnersByRace.get(blank(row.key) ?? "") ?? [],
    })),
    incidents: (tables.get("incidents") ?? []).map((row) => ({
      horseKey: blank(row.horseKey),
      raceKey: blank(row.raceKey),
      kind: blank(row.kind),
      code: blank(row.code),
      jurisdiction: blank(row.jurisdiction),
      obstacle: blank(row.obstacle),
      description: blank(row.description),
      publishedCause: blank(row.publishedCause),
      inquiry: blank(row.inquiry),
      examNote: blank(row.examNote),
      factAt: blank(row.factAt),
    })),
    episodes: (tables.get("episodes") ?? []).map((row) => ({
      key: blank(row.key),
      horseKey: blank(row.horseKey),
      documentedReason: blank(row.documentedReason),
      events: eventsByEpisode.get(blank(row.key) ?? "") ?? [],
    })),
    observations: (tables.get("observations") ?? []).map((row) => ({
      horseKey: blank(row.horseKey),
      attr: blank(row.attr),
      valueNum: numeric(row.valueNum, "observations.valueNum", errors),
      valueText: blank(row.valueText),
      unit: blank(row.unit),
      observedAt: blank(row.observedAt),
    })),
    workouts: (tables.get("workouts") ?? []).map((row) => ({
      horseKey: blank(row.horseKey),
      workedAt: blank(row.workedAt),
      course: blank(row.course),
      distanceM: numeric(row.distanceM, "workouts.distanceM", errors),
      timeSec: numeric(row.timeSec, "workouts.timeSec", errors),
      surface: blank(row.surface),
      going: blank(row.going),
      restricted: flag(row.restricted),
    })),
    facts: (tables.get("facts") ?? []).map((row) => {
      const raw = blank(row.value);
      const asNumber = raw != null && raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw;
      return {
        subjectType: blank(row.subjectType),
        subjectKey: blank(row.subjectKey),
        attr: blank(row.attr),
        value: asNumber,
        unit: blank(row.unit),
        observedAt: blank(row.observedAt),
        absenceReason: blank(row.absenceReason),
      };
    }),
    absences: (tables.get("absences") ?? []).map((row) => ({
      subjectType: blank(row.subjectType),
      subjectKey: blank(row.subjectKey),
      attr: blank(row.attr),
      reason: blank(row.reason),
    })),
  };
  if (errors.length) return { errors };
  const loose = Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
  return parseHistoryPack(loose);
}
