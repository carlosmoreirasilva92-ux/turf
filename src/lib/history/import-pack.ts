import { CATALOG_BY_KEY } from "./catalog.ts";
import { ABSENCE_REASONS, EPISODE_EVENTS, INCIDENT_KINDS, readWeights } from "./domain.ts";

export type Issue = { path: string; message: string };

const TOP = new Set([
  "origin",
  "sources",
  "entities",
  "aliases",
  "links",
  "courses",
  "races",
  "incidents",
  "episodes",
  "observations",
  "workouts",
  "facts",
  "absences",
]);
const KINDS = new Set(["horse", "jockey", "trainer", "owner", "stable"]);
const SOURCE_KINDS = new Set(["official", "attributed", "measurement", "manual", "estimate"]);
const ORIGINS = new Set(["user", "provider", "example"]);
const PRICE_KINDS = new Set(["preoff", "sp", "forecast"]);
const RUNNER_KEYS = new Set([
  "horseKey",
  "jockeyKey",
  "trainerKey",
  "cloth",
  "draw",
  "carriedLb",
  "bodyKg",
  "officialRating",
  "providerRating",
  "ownMetric",
  "started",
  "position",
  "deadHeat",
  "finishStatus",
  "comment",
  "prices",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function unknownKeys(value: Record<string, unknown>, allowed: Set<string>, path: string, errors: Issue[]) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push({ path: `${path}.${key}`, message: `Atributo não cadastrado: ${key}. Não foi descartado em silêncio.` });
  }
}

export type ParsedPack = {
  origin: "user" | "provider" | "example";
  sources: { key: string; name: string; kind: string }[];
  entities: { kind: string; key: string; name: string; country: string | null; sex: string | null; foaledYear: number | null; external: { provider: string; id: string } | null }[];
  aliases: { entityKey: string; kind: string; alias: string }[];
  links: { horseKey: string; otherKey: string; role: "trainer" | "owner" | "stable" }[];
  courses: { key: string; name: string; country: string }[];
  races: {
    key: string;
    courseKey: string | null;
    name: string;
    country: string | null;
    discipline: string | null;
    offAt: string;
    distanceM: number | null;
    going: string | null;
    surface: string | null;
    raceClass: string | null;
    weatherForecast: string | null;
    weatherObserved: string | null;
    status: string;
    runners: {
      horseKey: string;
      jockeyKey: string | null;
      trainerKey: string | null;
      cloth: number | null;
      draw: number | null;
      carriedLb: number | null;
      bodyKg: number | null;
      officialRating: number | null;
      providerRating: number | null;
      ownMetric: number | null;
      started: boolean;
      position: number | null;
      deadHeat: boolean;
      finishStatus: string | null;
      comment: string | null;
      prices: { book: string; market: string; decimal: number; kind: string; observedAt: string | null; currency: string | null }[];
    }[];
  }[];
  incidents: { horseKey: string; raceKey: string | null; kind: string; code: string | null; jurisdiction: string | null; obstacle: string | null; description: string | null; publishedCause: string | null; inquiry: string | null; examNote: string | null; factAt: string | null }[];
  episodes: { key: string; horseKey: string; documentedReason: string | null; events: { kind: string; eventAt: string | null; note: string | null }[] }[];
  observations: { horseKey: string; attr: string; valueNum: number | null; valueText: string | null; unit: string | null; observedAt: string | null }[];
  workouts: { horseKey: string; workedAt: string; course: string | null; distanceM: number | null; timeSec: number | null; surface: string | null; going: string | null; restricted: boolean }[];
  facts: { subjectType: string; subjectKey: string; attr: string; value: unknown; unit: string | null; observedAt: string | null; absenceReason: string | null }[];
  absences: { subjectType: string; subjectKey: string; attr: string; reason: string }[];
};

export function parseHistoryPack(value: unknown): { pack: ParsedPack } | { errors: Issue[] } {
  if (!isObject(value)) return { errors: [{ path: "", message: "O pacote tem de ser um objeto." }] };
  const errors: Issue[] = [];
  unknownKeys(value, TOP, "", errors);
  const origin = str(value.origin);
  if (!origin || !ORIGINS.has(origin)) errors.push({ path: "origin", message: "origin tem de ser user, provider ou example. synthetic é recusado." });
  if (value.origin === "synthetic") errors.push({ path: "origin", message: "Dados fictícios não entram no histórico." });
  const sources = readSources(value.sources, errors);
  const entities = readEntities(value.entities, errors);
  const aliases = readAliases(value.aliases, errors);
  const links = readLinks(value.links, errors);
  const courses = readCourses(value.courses, errors);
  const races = readRaces(value.races, errors);
  const incidents = readIncidents(value.incidents, errors);
  const episodes = readEpisodes(value.episodes, errors);
  const observations = readObservations(value.observations, errors);
  const workouts = readWorkouts(value.workouts, errors);
  const facts = readFacts(value.facts, errors);
  const absences = readAbsences(value.absences, errors);
  if (errors.length || !origin || !ORIGINS.has(origin)) return { errors };
  return {
    pack: {
      origin: origin as ParsedPack["origin"],
      sources,
      entities,
      aliases,
      links,
      courses,
      races,
      incidents,
      episodes,
      observations,
      workouts,
      facts,
      absences,
    },
  };
}

function list(value: unknown, path: string, errors: Issue[]): unknown[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    errors.push({ path, message: `${path} tem de ser uma lista.` });
    return [];
  }
  return value;
}

function readSources(value: unknown, errors: Issue[]) {
  return list(value, "sources", errors).flatMap((raw, index) => {
    if (!isObject(raw) || !str(raw.key) || !str(raw.name) || !str(raw.kind) || !SOURCE_KINDS.has(String(raw.kind))) {
      errors.push({ path: `sources[${index}]`, message: "Fonte precisa de key, name e kind oficial, atribuído, medição, manual ou estimativa." });
      return [];
    }
    return [{ key: str(raw.key)!, name: str(raw.name)!, kind: str(raw.kind)! }];
  });
}

function readEntities(value: unknown, errors: Issue[]) {
  const seen = new Set<string>();
  return list(value, "entities", errors).flatMap((raw, index) => {
    if (!isObject(raw) || !str(raw.kind) || !KINDS.has(String(raw.kind)) || !str(raw.key) || !str(raw.name)) {
      errors.push({ path: `entities[${index}]`, message: "Entidade precisa de kind, key e name. O nome sozinho não identifica." });
      return [];
    }
    const stamp = `${raw.kind}:${raw.key}`;
    if (seen.has(stamp)) errors.push({ path: `entities[${index}]`, message: "Chave repetida no mesmo pacote." });
    seen.add(stamp);
    let external: { provider: string; id: string } | null = null;
    if (raw.external != null) {
      if (!isObject(raw.external) || !str(raw.external.provider) || !str(raw.external.id)) {
        errors.push({ path: `entities[${index}].external`, message: "ID externo precisa de provider e id." });
      } else external = { provider: str(raw.external.provider)!, id: str(raw.external.id)! };
    }
    return [{
      kind: str(raw.kind)!,
      key: str(raw.key)!,
      name: str(raw.name)!,
      country: str(raw.country),
      sex: str(raw.sex),
      foaledYear: typeof raw.foaledYear === "number" ? raw.foaledYear : null,
      external,
    }];
  });
}

function readAliases(value: unknown, errors: Issue[]) {
  return list(value, "aliases", errors).flatMap((raw, index) => {
    if (!isObject(raw) || !str(raw.entityKey) || !str(raw.kind) || !str(raw.alias)) {
      errors.push({ path: `aliases[${index}]`, message: "Alias precisa de entityKey, kind e alias." });
      return [];
    }
    return [{ entityKey: str(raw.entityKey)!, kind: str(raw.kind)!, alias: str(raw.alias)! }];
  });
}

function readLinks(value: unknown, errors: Issue[]) {
  return list(value, "links", errors).flatMap((raw, index) => {
    if (!isObject(raw) || !str(raw.horseKey) || !str(raw.otherKey) || !["trainer", "owner", "stable"].includes(String(raw.role))) {
      errors.push({ path: `links[${index}]`, message: "Vínculo precisa de horseKey, otherKey e role." });
      return [];
    }
    return [{ horseKey: str(raw.horseKey)!, otherKey: str(raw.otherKey)!, role: raw.role as "trainer" | "owner" | "stable" }];
  });
}

function readCourses(value: unknown, errors: Issue[]) {
  return list(value, "courses", errors).flatMap((raw, index) => {
    if (!isObject(raw) || !str(raw.key) || !str(raw.name) || !str(raw.country)) {
      errors.push({ path: `courses[${index}]`, message: "Hipódromo precisa de key, name e country." });
      return [];
    }
    return [{ key: str(raw.key)!, name: str(raw.name)!, country: str(raw.country)! }];
  });
}

function readRaces(value: unknown, errors: Issue[]) {
  const seen = new Set<string>();
  return list(value, "races", errors).flatMap((raw, index) => {
    const path = `races[${index}]`;
    if (!isObject(raw) || !str(raw.key) || !str(raw.name) || !str(raw.offAt) || Number.isNaN(Date.parse(String(raw.offAt)))) {
      errors.push({ path, message: "Corrida precisa de key, name e offAt em UTC." });
      return [];
    }
    if (seen.has(String(raw.key))) errors.push({ path, message: "race key repetida." });
    seen.add(String(raw.key));
    if (!Array.isArray(raw.runners) || raw.runners.length === 0) {
      errors.push({ path: `${path}.runners`, message: "A corrida precisa dos participantes, incluindo quem não ganhou." });
      return [];
    }
    const runners = raw.runners.flatMap((runnerRaw, runnerIndex) => {
      if (!isObject(runnerRaw) || !str(runnerRaw.horseKey)) {
        errors.push({ path: `${path}.runners[${runnerIndex}]`, message: "Participante precisa de horseKey." });
        return [];
      }
      unknownKeys(runnerRaw, RUNNER_KEYS, `${path}.runners[${runnerIndex}]`, errors);
      const weights = readWeights(runnerRaw);
      if (!weights.ok) {
        errors.push({ path: `${path}.runners[${runnerIndex}]`, message: weights.error });
        return [];
      }
      const prices = Array.isArray(runnerRaw.prices)
        ? runnerRaw.prices.flatMap((priceRaw, priceIndex) => {
            if (!isObject(priceRaw) || !str(priceRaw.book) || priceRaw.market !== "WIN" || typeof priceRaw.decimal !== "number" || !(priceRaw.decimal > 1)) {
              errors.push({ path: `${path}.runners[${runnerIndex}].prices[${priceIndex}]`, message: "Preço WIN precisa de book e decimal maior do que 1." });
              return [];
            }
            const kind = str(priceRaw.kind) ?? "preoff";
            if (!PRICE_KINDS.has(kind)) {
              errors.push({ path: `${path}.runners[${runnerIndex}].prices[${priceIndex}]`, message: "kind é preoff, sp ou forecast." });
              return [];
            }
            if (priceRaw.observedAt != null && (typeof priceRaw.observedAt !== "string" || Number.isNaN(Date.parse(priceRaw.observedAt)))) {
              errors.push({ path: `${path}.runners[${runnerIndex}].prices[${priceIndex}]`, message: "observedAt inválido. A hora de recepção não o substitui." });
              return [];
            }
            return [{
              book: str(priceRaw.book)!,
              market: "WIN",
              decimal: priceRaw.decimal,
              kind,
              observedAt: typeof priceRaw.observedAt === "string" ? priceRaw.observedAt : null,
              currency: str(priceRaw.currency),
            }];
          })
        : [];
      return [{
        horseKey: str(runnerRaw.horseKey)!,
        jockeyKey: str(runnerRaw.jockeyKey),
        trainerKey: str(runnerRaw.trainerKey),
        cloth: typeof runnerRaw.cloth === "number" ? runnerRaw.cloth : null,
        draw: typeof runnerRaw.draw === "number" ? runnerRaw.draw : null,
        carriedLb: weights.carriedLb,
        bodyKg: weights.bodyKg,
        officialRating: typeof runnerRaw.officialRating === "number" ? runnerRaw.officialRating : null,
        providerRating: typeof runnerRaw.providerRating === "number" ? runnerRaw.providerRating : null,
        ownMetric: typeof runnerRaw.ownMetric === "number" ? runnerRaw.ownMetric : null,
        started: runnerRaw.started !== false,
        position: typeof runnerRaw.position === "number" ? runnerRaw.position : null,
        deadHeat: runnerRaw.deadHeat === true,
        finishStatus: str(runnerRaw.finishStatus),
        comment: str(runnerRaw.comment),
        prices,
      }];
    });
    return [{
      key: str(raw.key)!,
      courseKey: str(raw.courseKey),
      name: str(raw.name)!,
      country: str(raw.country),
      discipline: str(raw.discipline),
      offAt: new Date(String(raw.offAt)).toISOString(),
      distanceM: typeof raw.distanceM === "number" ? raw.distanceM : null,
      going: str(raw.going),
      surface: str(raw.surface),
      raceClass: str(raw.raceClass),
      weatherForecast: str(raw.weatherForecast),
      weatherObserved: str(raw.weatherObserved),
      status: str(raw.status) ?? "declared",
      runners,
    }];
  });
}

function readIncidents(value: unknown, errors: Issue[]) {
  return list(value, "incidents", errors).flatMap((raw, index) => {
    if (!isObject(raw) || !str(raw.horseKey) || !str(raw.kind) || !INCIDENT_KINDS.has(String(raw.kind))) {
      errors.push({ path: `incidents[${index}]`, message: "Incidente precisa de horseKey e kind fall, brought-down, unseated, refused, pulled-up ou other." });
      return [];
    }
    return [{
      horseKey: str(raw.horseKey)!,
      raceKey: str(raw.raceKey),
      kind: str(raw.kind)!,
      code: str(raw.code),
      jurisdiction: str(raw.jurisdiction),
      obstacle: str(raw.obstacle),
      description: str(raw.description),
      publishedCause: str(raw.publishedCause),
      inquiry: str(raw.inquiry),
      examNote: str(raw.examNote),
      factAt: str(raw.factAt),
    }];
  });
}

function readEpisodes(value: unknown, errors: Issue[]) {
  return list(value, "episodes", errors).flatMap((raw, index) => {
    if (!isObject(raw) || !str(raw.key) || !str(raw.horseKey)) {
      errors.push({ path: `episodes[${index}]`, message: "Episódio precisa de key e horseKey." });
      return [];
    }
    const events = list(raw.events, `episodes[${index}].events`, errors).flatMap((eventRaw, eventIndex) => {
      if (!isObject(eventRaw) || !str(eventRaw.kind) || !EPISODE_EVENTS.has(String(eventRaw.kind))) {
        errors.push({ path: `episodes[${index}].events[${eventIndex}]`, message: "Evento de recuperação desconhecido." });
        return [];
      }
      return [{ kind: str(eventRaw.kind)!, eventAt: str(eventRaw.eventAt), note: str(eventRaw.note) }];
    });
    return [{ key: str(raw.key)!, horseKey: str(raw.horseKey)!, documentedReason: str(raw.documentedReason), events }];
  });
}

function readObservations(value: unknown, errors: Issue[]) {
  return list(value, "observations", errors).flatMap((raw, index) => {
    if (!isObject(raw) || !str(raw.horseKey) || !str(raw.attr) || !CATALOG_BY_KEY.has(String(raw.attr))) {
      errors.push({ path: `observations[${index}]`, message: "Observação precisa de horseKey e de um atributo do catálogo." });
      return [];
    }
    return [{
      horseKey: str(raw.horseKey)!,
      attr: str(raw.attr)!,
      valueNum: typeof raw.valueNum === "number" ? raw.valueNum : null,
      valueText: str(raw.valueText),
      unit: str(raw.unit),
      observedAt: str(raw.observedAt),
    }];
  });
}

function readWorkouts(value: unknown, errors: Issue[]) {
  return list(value, "workouts", errors).flatMap((raw, index) => {
    if (!isObject(raw) || !str(raw.horseKey) || !str(raw.workedAt) || Number.isNaN(Date.parse(String(raw.workedAt)))) {
      errors.push({ path: `workouts[${index}]`, message: "Treino precisa de horseKey e workedAt." });
      return [];
    }
    return [{
      horseKey: str(raw.horseKey)!,
      workedAt: new Date(String(raw.workedAt)).toISOString(),
      course: str(raw.course),
      distanceM: typeof raw.distanceM === "number" ? raw.distanceM : null,
      timeSec: typeof raw.timeSec === "number" ? raw.timeSec : null,
      surface: str(raw.surface),
      going: str(raw.going),
      restricted: raw.restricted === true,
    }];
  });
}

function readFacts(value: unknown, errors: Issue[]) {
  return list(value, "facts", errors).flatMap((raw, index) => {
    if (!isObject(raw) || !str(raw.subjectType) || !str(raw.subjectKey) || !str(raw.attr)) {
      errors.push({ path: `facts[${index}]`, message: "Facto precisa de subjectType, subjectKey e attr." });
      return [];
    }
    if (!CATALOG_BY_KEY.has(String(raw.attr))) {
      errors.push({ path: `facts[${index}].attr`, message: `O atributo ${String(raw.attr)} não está no catálogo. Cadastre-o antes de o gravar.` });
      return [];
    }
    const absence = str(raw.absenceReason);
    if (raw.value == null && !absence) {
      errors.push({ path: `facts[${index}]`, message: "Valor vazio precisa de um motivo de ausência." });
      return [];
    }
    if (absence && !ABSENCE_REASONS.has(absence)) {
      errors.push({ path: `facts[${index}].absenceReason`, message: "Motivo de ausência desconhecido." });
      return [];
    }
    return [{
      subjectType: str(raw.subjectType)!,
      subjectKey: str(raw.subjectKey)!,
      attr: str(raw.attr)!,
      value: raw.value ?? null,
      unit: str(raw.unit),
      observedAt: str(raw.observedAt),
      absenceReason: absence,
    }];
  });
}

function readAbsences(value: unknown, errors: Issue[]) {
  return list(value, "absences", errors).flatMap((raw, index) => {
    if (!isObject(raw) || !str(raw.subjectType) || !str(raw.subjectKey) || !str(raw.attr) || !str(raw.reason) || !ABSENCE_REASONS.has(String(raw.reason))) {
      errors.push({ path: `absences[${index}]`, message: "Ausência precisa de sujeito, atributo do catálogo e motivo." });
      return [];
    }
    if (!CATALOG_BY_KEY.has(String(raw.attr))) {
      errors.push({ path: `absences[${index}]`, message: "A ausência refere um atributo fora do catálogo." });
      return [];
    }
    return [{ subjectType: str(raw.subjectType)!, subjectKey: str(raw.subjectKey)!, attr: str(raw.attr)!, reason: str(raw.reason)! }];
  });
}
