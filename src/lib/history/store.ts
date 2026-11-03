import { randomUUID } from "node:crypto";
import { contentHash } from "../racing/hash.ts";
import { parseHistoryPack, type ParsedPack } from "./import-pack.ts";
import {
  binaryScores,
  distanceBand,
  featuresAt,
  featureAllowList,
  fitLogistic,
  foldWholeRaces,
  longshotRecord,
  marketFlags,
  predictLogistic,
  promotionDecision,
  rateRows,
  recoveryLabels,
  reliabilityBins,
  runsAfterReturn,
  incidentCause,
  vectorFrom,
  withoutMarket,
  type PriorRun,
} from "./domain.ts";

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

function iso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function tx<T>(sql: Queryable, run: () => Promise<T>): Promise<T> {
  await sql.query("begin");
  try {
    const value = await run();
    await sql.query("commit");
    return value;
  } catch (error) {
    try {
      await sql.query("rollback");
    } catch {
      /* keep the original error */
    }
    throw error;
  }
}

export type ImportReport = {
  origin: string;
  races: number;
  runners: number;
  revisions: number;
  pendingMatches: number;
  coverage: { field: string; filled: number; missing: number }[];
  example: boolean;
  digest: string;
};

function readReport(value: ImportReport | string | null | undefined): ImportReport | null {
  if (value == null) return null;
  if (typeof value === "string") return JSON.parse(value) as ImportReport;
  return value;
}

export async function importHistory(sql: Queryable, userId: string, body: unknown, importKey: string) {
  if (!importKey || importKey.length > 80) return { ok: false as const, errors: [{ path: "importKey", message: "Chave de importação em falta." }] };
  const parsed = parseHistoryPack(body);
  if ("errors" in parsed) return { ok: false as const, errors: parsed.errors };
  const digest = contentHash(parsed.pack);
  const storedKey = importKey === "auto" ? digest.slice(0, 64) : importKey;
  const prior = await sql.query<{ import_key: string; report: ImportReport | string }>(
    "select import_key, report from h_imports where user_id = $1 and status = 'ok' and (import_key = $2 or report->>'digest' = $3)",
    [userId, storedKey, digest],
  );
  const rows = prior.map((row) => ({ key: row.import_key, report: readReport(row.report) }));
  const same = rows.find((row) => row.report?.digest === digest);
  if (same?.report) return { ok: true as const, replay: true, report: same.report };
  if (rows.some((row) => row.key === storedKey)) {
    return { ok: false as const, errors: [{ path: "importKey", message: "Esta chave já gravou um pacote diferente. O conteúdo anterior ficou." }] };
  }
  try {
    const report = await tx(sql, () => writePack(sql, userId, parsed.pack, storedKey, digest));
    return { ok: true as const, replay: false, report };
  } catch (error) {
    const again = await sql.query<{ import_key: string; report: ImportReport | string }>(
      "select import_key, report from h_imports where user_id = $1 and status = 'ok' and (import_key = $2 or report->>'digest' = $3)",
      [userId, storedKey, digest],
    );
    const recovered = again.map((row) => readReport(row.report)).find((report) => report?.digest === digest);
    if (recovered) return { ok: true as const, replay: true, report: recovered };
    return { ok: false as const, errors: [{ path: "import", message: error instanceof Error ? error.message : "A importação falhou e foi revertida." }] };
  }
}

async function writePack(sql: Queryable, userId: string, pack: ParsedPack, importKey: string, digest: string): Promise<ImportReport> {
  const sources = new Map<string, string>();
  for (const source of pack.sources) {
    const id = await upsertSource(sql, userId, source);
    sources.set(source.key, id);
  }
  const entities = new Map<string, string>();
  let pendingMatches = 0;
  for (const entity of pack.entities) {
    const resolved = await resolveEntity(sql, userId, pack.origin, entity);
    entities.set(`${entity.kind}:${entity.key}`, resolved.id);
    if (resolved.matched) pendingMatches += 1;
  }
  for (const alias of pack.aliases) {
    const id = entities.get(`${alias.kind}:${alias.entityKey}`);
    if (!id) throw new Error(`Alias sem entidade ${alias.entityKey}.`);
    await sql.query("insert into h_aliases (id, user_id, entity_id, alias) values ($1,$2,$3,$4)", [randomUUID(), userId, id, alias.alias]);
  }
  for (const link of pack.links) {
    const horse = entities.get(`horse:${link.horseKey}`);
    const other = entities.get(`${link.role}:${link.otherKey}`) ?? entities.get(`trainer:${link.otherKey}`) ?? entities.get(`owner:${link.otherKey}`) ?? entities.get(`stable:${link.otherKey}`);
    if (!horse || !other) throw new Error(`Vínculo incompleto ${link.horseKey}.`);
    await sql.query(
      "insert into h_links (id, user_id, horse_id, other_id, role) values ($1,$2,$3,$4,$5)",
      [randomUUID(), userId, horse, other, link.role],
    );
  }
  const courses = new Map<string, string>();
  for (const course of pack.courses) {
    const id = await upsertCourse(sql, userId, course);
    courses.set(course.key, id);
  }
  let races = 0;
  let runners = 0;
  let revisions = 0;
  for (const race of pack.races) {
    const raceId = await upsertRace(sql, userId, pack.origin, race, courses.get(race.courseKey ?? "") ?? null);
    races += 1;
    for (const runner of race.runners) {
      const horseId = entities.get(`horse:${runner.horseKey}`);
      if (!horseId) throw new Error(`Cavalo desconhecido ${runner.horseKey}.`);
      const wrote = await upsertRunner(sql, userId, raceId, horseId, entities.get(`jockey:${runner.jockeyKey}`) ?? null, entities.get(`trainer:${runner.trainerKey}`) ?? null, runner);
      runners += 1;
      revisions += wrote.revisions;
      for (const price of runner.prices) {
        await insertPrice(sql, userId, wrote.id, price);
      }
    }
  }
  for (const incident of pack.incidents) {
    const horseId = entities.get(`horse:${incident.horseKey}`);
    if (!horseId) throw new Error(`Incidente sem cavalo ${incident.horseKey}.`);
    await sql.query(
      `insert into h_incidents (id, user_id, horse_id, kind, code, jurisdiction, obstacle, description, published_cause, inquiry, exam_note, fact_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [randomUUID(), userId, horseId, incident.kind, incident.code, incident.jurisdiction, incident.obstacle, incident.description, incident.publishedCause, incident.inquiry, incident.examNote, incident.factAt],
    );
  }
  for (const episode of pack.episodes) {
    const horseId = entities.get(`horse:${episode.horseKey}`);
    if (!horseId) throw new Error(`Episódio sem cavalo ${episode.horseKey}.`);
    const existing = await sql.query<{ id: string }>("select id from h_episodes where user_id = $1 and episode_key = $2", [userId, episode.key]);
    const episodeId = existing[0]?.id ?? randomUUID();
    if (!existing[0]) {
      await sql.query(
        "insert into h_episodes (id, user_id, horse_id, episode_key, documented_reason) values ($1,$2,$3,$4,$5)",
        [episodeId, userId, horseId, episode.key, episode.documentedReason],
      );
    }
    for (const event of episode.events) {
      const already = await sql.query<{ id: string }>(
        "select id from h_episode_events where episode_id = $1 and kind = $2 and event_at is not distinct from $3::timestamptz and note is not distinct from $4 limit 1",
        [episodeId, event.kind, event.eventAt, event.note],
      );
      if (already[0]) continue;
      await sql.query(
        "insert into h_episode_events (id, user_id, episode_id, kind, event_at, note) values ($1,$2,$3,$4,$5,$6)",
        [randomUUID(), userId, episodeId, event.kind, event.eventAt, event.note],
      );
    }
  }
  for (const observation of pack.observations) {
    const horseId = entities.get(`horse:${observation.horseKey}`);
    if (!horseId) throw new Error(`Observação sem cavalo ${observation.horseKey}.`);
    await sql.query(
      "insert into h_observations (id, user_id, entity_id, attr, value_num, value_text, unit, observed_at) values ($1,$2,$3,$4,$5,$6,$7,$8)",
      [randomUUID(), userId, horseId, observation.attr, observation.valueNum, observation.valueText, observation.unit, observation.observedAt],
    );
  }
  for (const workout of pack.workouts) {
    const horseId = entities.get(`horse:${workout.horseKey}`);
    if (!horseId) throw new Error(`Treino sem cavalo ${workout.horseKey}.`);
    await sql.query(
      `insert into h_workouts (id, user_id, horse_id, worked_at, course, distance_m, time_sec, surface, going, restricted)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [randomUUID(), userId, horseId, workout.workedAt, workout.course, workout.distanceM, workout.timeSec, workout.surface, workout.going, workout.restricted],
    );
  }
  for (const fact of pack.facts) {
    const subjectId = entities.get(`${fact.subjectType}:${fact.subjectKey}`) ?? fact.subjectKey;
    const latest = await sql.query<{ value_json: unknown }>(
      "select value_json from h_facts where user_id = $1 and subject_type = $2 and subject_id = $3 and attr = $4 order by ingested_at desc limit 1",
      [userId, fact.subjectType, subjectId, fact.attr],
    );
    const next = JSON.stringify(fact.value);
    if (latest[0] && JSON.stringify(latest[0].value_json) === next) continue;
    await sql.query(
      `insert into h_facts (id, user_id, subject_type, subject_id, attr, value_json, unit, observed_at, absence_reason)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`,
      [randomUUID(), userId, fact.subjectType, subjectId, fact.attr, next, fact.unit, fact.observedAt, fact.absenceReason],
    );
  }
  for (const absence of pack.absences) {
    const subjectId = entities.get(`${absence.subjectType}:${absence.subjectKey}`) ?? absence.subjectKey;
    await sql.query(
      `insert into h_absences (id, user_id, subject_type, subject_id, attr, reason) values ($1,$2,$3,$4,$5,$6)
       on conflict (user_id, subject_type, subject_id, attr) do update set reason = excluded.reason`,
      [randomUUID(), userId, absence.subjectType, subjectId, absence.attr, absence.reason],
    );
  }
  const coverage = await writeCoverage(sql, userId);
  const report: ImportReport = { origin: pack.origin, races, runners, revisions, pendingMatches, coverage, example: pack.origin === "example", digest };
  await sql.query(
    "insert into h_imports (id, user_id, import_key, origin, status, report) values ($1,$2,$3,$4,'ok',$5::jsonb)",
    [randomUUID(), userId, importKey, pack.origin, JSON.stringify(report)],
  );
  return report;
}

async function upsertSource(sql: Queryable, userId: string, source: ParsedPack["sources"][number]) {
  const found = await sql.query<{ id: string }>("select id from h_sources where user_id = $1 and source_key = $2", [userId, source.key]);
  if (found[0]) return found[0].id;
  const id = randomUUID();
  await sql.query("insert into h_sources (id, user_id, source_key, name, kind) values ($1,$2,$3,$4,$5)", [id, userId, source.key, source.name, source.kind]);
  return id;
}

async function resolveEntity(
  sql: Queryable,
  userId: string,
  origin: ParsedPack["origin"],
  entity: ParsedPack["entities"][number],
): Promise<{ id: string; matched: boolean }> {
  const byKey = await sql.query<{ id: string }>(
    "select id from h_entities where user_id = $1 and kind = $2 and entity_key = $3",
    [userId, entity.kind, entity.key],
  );
  if (entity.external) {
    const byExternal = await sql.query<{ entity_id: string }>(
      "select entity_id from h_external_ids where user_id = $1 and provider = $2 and external_id = $3",
      [userId, entity.external.provider, entity.external.id],
    );
    if (byExternal[0]) return { id: byExternal[0].entity_id, matched: false };
  }
  if (byKey[0]) return { id: byKey[0].id, matched: false };
  const homonyms = await sql.query<{ entity_key: string }>(
    "select entity_key from h_entities where user_id = $1 and kind = $2 and lower(name) = lower($3)",
    [userId, entity.kind, entity.name],
  );
  let matched = false;
  for (const homonym of homonyms) {
    matched = true;
    const already = await sql.query<{ id: string }>(
      "select id from h_matches where user_id = $1 and kind = $2 and left_key = $3 and right_key = $4",
      [userId, entity.kind, homonym.entity_key, entity.key],
    );
    if (!already[0]) {
      await sql.query(
        "insert into h_matches (id, user_id, kind, name, left_key, right_key, reason) values ($1,$2,$3,$4,$5,$6,$7)",
        [randomUUID(), userId, entity.kind, entity.name, homonym.entity_key, entity.key, "Nome igual com chaves diferentes. Não foram fundidos."],
      );
    }
  }
  const id = randomUUID();
  await sql.query(
    `insert into h_entities (id, user_id, kind, entity_key, name, country, sex, foaled_year, origin)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, userId, entity.kind, entity.key, entity.name, entity.country, entity.sex, entity.foaledYear, origin],
  );
  if (entity.external) {
    await sql.query(
      "insert into h_external_ids (id, user_id, entity_id, provider, external_id) values ($1,$2,$3,$4,$5)",
      [randomUUID(), userId, id, entity.external.provider, entity.external.id],
    );
  }
  return { id, matched };
}

async function upsertCourse(sql: Queryable, userId: string, course: ParsedPack["courses"][number]) {
  const found = await sql.query<{ id: string }>("select id from h_courses where user_id = $1 and course_key = $2", [userId, course.key]);
  if (found[0]) return found[0].id;
  const id = randomUUID();
  await sql.query("insert into h_courses (id, user_id, course_key, name, country) values ($1,$2,$3,$4,$5)", [id, userId, course.key, course.name, course.country]);
  return id;
}

async function upsertRace(sql: Queryable, userId: string, origin: string, race: ParsedPack["races"][number], courseId: string | null) {
  const found = await sql.query<{ id: string; status: string }>("select id, status from h_races where user_id = $1 and race_key = $2", [userId, race.key]);
  if (found[0]) {
    if (found[0].status !== race.status) {
      await sql.query(
        "insert into h_race_revisions (id, user_id, race_id, status, note) values ($1,$2,$3,$4,$5)",
        [randomUUID(), userId, found[0].id, found[0].status, "Estado anterior conservado."],
      );
      await sql.query("update h_races set status = $2, weather_observed = coalesce($3, weather_observed) where id = $1", [found[0].id, race.status, race.weatherObserved]);
    }
    return found[0].id;
  }
  const id = randomUUID();
  await sql.query(
    `insert into h_races (id, user_id, race_key, course_id, name, country, discipline, off_at, distance_m, going, surface, race_class, weather_forecast, weather_observed, status, origin)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [id, userId, race.key, courseId, race.name, race.country, race.discipline, race.offAt, race.distanceM, race.going, race.surface, race.raceClass, race.weatherForecast, race.weatherObserved, race.status, origin],
  );
  return id;
}

async function upsertRunner(
  sql: Queryable,
  userId: string,
  raceId: string,
  horseId: string,
  jockeyId: string | null,
  trainerId: string | null,
  runner: ParsedPack["races"][number]["runners"][number],
) {
  const found = await sql.query<{ id: string; position: number | null; started: boolean; carried_lb: string | number | null; comment: string | null }>(
    "select id, position, started, carried_lb, comment from h_runners where user_id = $1 and race_id = $2 and horse_id = $3",
    [userId, raceId, horseId],
  );
  if (!found[0]) {
    const id = randomUUID();
    await sql.query(
      `insert into h_runners (id, user_id, race_id, horse_id, jockey_id, trainer_id, cloth, draw, carried_lb, body_kg, official_rating, provider_rating, own_metric, started, position, dead_heat, finish_status, comment)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [id, userId, raceId, horseId, jockeyId, trainerId, runner.cloth, runner.draw, runner.carriedLb, runner.bodyKg, runner.officialRating, runner.providerRating, runner.ownMetric, runner.started, runner.position, runner.deadHeat, runner.finishStatus, runner.comment],
    );
    return { id, revisions: 0 };
  }
  const previous = { position: num(found[0].position), started: found[0].started, carriedLb: num(found[0].carried_lb), comment: found[0].comment };
  const changed = previous.position !== runner.position || previous.started !== runner.started || previous.carriedLb !== runner.carriedLb || previous.comment !== runner.comment;
  if (changed) {
    await sql.query("insert into h_runner_revisions (id, user_id, runner_id, patch) values ($1,$2,$3,$4::jsonb)", [randomUUID(), userId, found[0].id, JSON.stringify(previous)]);
    await sql.query(
      "update h_runners set position = $2, started = $3, carried_lb = $4, body_kg = $5, comment = $6, jockey_id = coalesce($7, jockey_id), trainer_id = coalesce($8, trainer_id) where id = $1",
      [found[0].id, runner.position, runner.started, runner.carriedLb, runner.bodyKg, runner.comment, jockeyId, trainerId],
    );
  }
  return { id: found[0].id, revisions: changed ? 1 : 0 };
}

async function insertPrice(sql: Queryable, userId: string, runnerId: string, price: ParsedPack["races"][number]["runners"][number]["prices"][number]) {
  const existing = await sql.query<{ id: string }>(
    `select id from h_prices where user_id = $1 and runner_id = $2 and book = $3 and market = $4 and kind = $5 and decimal_odds = $6
       and observed_at is not distinct from $7::timestamptz`,
    [userId, runnerId, price.book, price.market, price.kind, price.decimal, price.observedAt],
  );
  if (existing[0]) return;
  await sql.query(
    `insert into h_prices (id, user_id, runner_id, book, market, decimal_odds, kind, observed_at, received_at, currency)
     values ($1,$2,$3,$4,$5,$6,$7,$8, now(), $9)`,
    [randomUUID(), userId, runnerId, price.book, price.market, price.decimal, price.kind, price.observedAt, price.currency],
  );
}

async function writeCoverage(sql: Queryable, userId: string) {
  const rows = await sql.query<{ runners: number; carried: number; priced: number; positioned: number }>(
    `select count(*)::int as runners,
            count(*) filter (where r.carried_lb is not null)::int as carried,
            count(*) filter (where exists (
              select 1 from h_prices p where p.runner_id = r.id and p.kind = 'preoff' and p.observed_at is not null
            ))::int as priced,
            count(*) filter (where r.position is not null)::int as positioned
       from h_runners r
       join h_races a on a.id = r.race_id
      where r.user_id = $1 and a.origin <> 'example'`,
    [userId],
  );
  const totals = rows[0] ?? { runners: 0, carried: 0, priced: 0, positioned: 0 };
  const fields = [
    ["carried_lb", Number(totals.carried), Number(totals.runners) - Number(totals.carried)],
    ["preoff_price", Number(totals.priced), Number(totals.runners) - Number(totals.priced)],
    ["finish_position", Number(totals.positioned), Number(totals.runners) - Number(totals.positioned)],
  ] as const;
  for (const [field, filled, missing] of fields) {
    await sql.query(
      "insert into h_coverage (id, user_id, field_name, filled, missing) values ($1,$2,$3,$4,$5)",
      [randomUUID(), userId, field, filled, missing],
    );
  }
  return fields.map(([field, filled, missing]) => ({ field, filled, missing }));
}

export async function listEntities(sql: Queryable, userId: string, filter: { kind: string; q?: string; limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(filter.limit ?? 20, 1), 50);
  const offset = Math.max(filter.offset ?? 0, 0);
  const totalRows = await sql.query<{ n: number }>(
    `select count(*)::int as n from h_entities where user_id = $1 and kind = $2 and ($3::text is null or name ilike $3)`,
    [userId, filter.kind, filter.q ? `%${filter.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%` : null],
  );
  const rows = await sql.query<{ id: string; entity_key: string; name: string; country: string | null; origin: string }>(
    `select id, entity_key, name, country, origin from h_entities
      where user_id = $1 and kind = $2 and ($3::text is null or name ilike $3)
      order by name, id limit $4 offset $5`,
    [userId, filter.kind, filter.q ? `%${filter.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%` : null, limit, offset],
  );
  return { total: Number(totalRows[0]?.n ?? 0), limit, offset, entities: rows };
}

type RunRow = {
  runner_id: string;
  horse_id: string;
  position: number | null;
  started: boolean;
  carried_lb: string | number | null;
  body_kg: string | number | null;
  comment: string | null;
  course: string | null;
  off_at: string | Date;
  race_name: string;
  race_key: string;
  race_id: string;
  distance_m: number | null;
  going: string | null;
  origin: string;
  jockey: string | null;
  trainer: string | null;
  jockey_key: string | null;
  trainer_key: string | null;
};

async function runsFor(sql: Queryable, userId: string, column: "horse_id" | "jockey_id" | "trainer_id", id: string) {
  return sql.query<RunRow>(
    `select r.id as runner_id, r.horse_id, r.position, r.started, r.carried_lb, r.body_kg, r.comment,
            c.name as course, a.off_at, a.name as race_name, a.race_key, a.id as race_id, a.distance_m, a.going, a.origin,
            j.name as jockey, t.name as trainer, j.entity_key as jockey_key, t.entity_key as trainer_key
       from h_runners r
       join h_races a on a.id = r.race_id
       left join h_courses c on c.id = a.course_id
       left join h_entities j on j.id = r.jockey_id
       left join h_entities t on t.id = r.trainer_id
      where r.user_id = $1 and r.${column} = $2
      order by a.off_at, r.id`,
    [userId, id],
  );
}

async function pricesFor(sql: Queryable, userId: string, runnerIds: string[]) {
  if (runnerIds.length === 0) return [];
  const rows = await sql.query<{ runner_id: string; book: string; decimal_odds: string | number; kind: string; observed_at: string | Date | null; currency: string | null }>(
    "select runner_id, book, decimal_odds, kind, observed_at, currency from h_prices where user_id = $1",
    [userId],
  );
  const wanted = new Set(runnerIds);
  return rows.filter((row) => wanted.has(row.runner_id));
}

function timedPreoff(prices: { kind: string; observed_at: string | Date | null; decimal_odds: string | number; book: string }[], offAt: string) {
  const off = Date.parse(offAt);
  const rows = prices.filter((price) => price.kind === "preoff" && price.observed_at && Date.parse(iso(price.observed_at)!) < off);
  if (rows.length === 0) return null;
  const books = new Set(rows.map((price) => price.book));
  if (books.size > 1) return { mixed: true as const };
  const latest = [...rows].sort((a, b) => Date.parse(iso(a.observed_at)!) - Date.parse(iso(b.observed_at)!)).at(-1)!;
  return { mixed: false as const, book: latest.book, decimal: Number(latest.decimal_odds), observedAt: iso(latest.observed_at) };
}

export async function horseProfile(sql: Queryable, userId: string, horseId: string) {
  const horses = await sql.query<{ id: string; name: string; country: string | null; origin: string; entity_key: string; foaled_year: number | null }>(
    "select id, name, country, origin, entity_key, foaled_year from h_entities where id = $1 and user_id = $2 and kind = 'horse'",
    [horseId, userId],
  );
  const horse = horses[0];
  if (!horse) return null;
  const runs = await runsFor(sql, userId, "horse_id", horseId);
  const prices = await pricesFor(sql, userId, runs.map((run) => run.runner_id));
  const byRunner = new Map<string, typeof prices>();
  for (const price of prices) {
    const list = byRunner.get(price.runner_id) ?? [];
    list.push(price);
    byRunner.set(price.runner_id, list);
  }
  const siblings = await sql.query<{ race_id: string; runner_id: string; book: string; decimal_odds: string | number; kind: string; observed_at: string | Date | null; off_at: string | Date }>(
    `select r.race_id, r.id as runner_id, p.book, p.decimal_odds, p.kind, p.observed_at, a.off_at
       from h_runners r
       join h_races a on a.id = r.race_id
       join h_prices p on p.runner_id = r.id and p.user_id = r.user_id
      where r.user_id = $1 and r.race_id in (select race_id from h_runners where user_id = $1 and horse_id = $2)`,
    [userId, horseId],
  );
  const fieldByRace = new Map<string, number[]>();
  const siblingGroups = new Map<string, typeof siblings>();
  for (const row of siblings) {
    const list = siblingGroups.get(row.runner_id) ?? [];
    list.push(row);
    siblingGroups.set(row.runner_id, list);
  }
  for (const rows of siblingGroups.values()) {
    const timed = timedPreoff(rows, iso(rows[0]!.off_at)!);
    if (timed && !timed.mixed) {
      const field = fieldByRace.get(rows[0]!.race_id) ?? [];
      field.push(timed.decimal);
      fieldByRace.set(rows[0]!.race_id, field);
    }
  }
  const history = runs.map((run) => {
    const offAt = iso(run.off_at)!;
    const timed = timedPreoff(byRunner.get(run.runner_id) ?? [], offAt);
    const decimal = timed && !timed.mixed ? timed.decimal : null;
    const flags = marketFlags(decimal, fieldByRace.get(run.race_id) ?? (decimal ? [decimal] : []), run.position === 1, (run.position ?? 99) <= 3);
    const priors: PriorRun[] = runs.filter((item) => item.horse_id === horseId).map((item) => ({
      offAt: iso(item.off_at)!,
      started: item.started,
      position: num(item.position),
      course: item.course,
      distanceM: num(item.distance_m),
      going: item.going,
      jockeyKey: item.jockey_key,
      trainerKey: item.trainer_key,
      preoff: null,
    }));
    const knownBefore = featuresAt(priors, offAt, {
      jockeyKey: run.jockey_key,
      trainerKey: run.trainer_key,
      course: run.course,
      distanceM: num(run.distance_m),
      going: run.going,
      preoff: decimal,
    });
    return {
      runnerId: run.runner_id,
      raceId: run.race_id,
      raceKey: run.race_key,
      race: run.race_name,
      offAt,
      course: run.course,
      going: run.going,
      distanceM: num(run.distance_m),
      origin: run.origin,
      jockey: run.jockey,
      trainer: run.trainer,
      carriedLb: num(run.carried_lb),
      bodyKg: num(run.body_kg),
      started: run.started,
      position: num(run.position),
      price: timed && !timed.mixed ? { book: timed.book, decimal: timed.decimal, observedAt: timed.observedAt, stale: false } : { book: null, decimal: null, observedAt: null, stale: Boolean(timed && timed.mixed) },
      flags,
      knownBefore,
      knownAfter: { position: num(run.position), comment: run.comment },
    };
  });
  const realStarts = history.filter((run) => run.origin !== "example").map((run) => ({
    started: run.started,
    decimal: run.price.decimal,
    won: run.position === 1,
    placed: run.position != null && run.position <= 3,
    field: fieldByRace.get(run.raceId) ?? [],
  }));
  const incidents = await sql.query<{ kind: string; code: string | null; published_cause: string | null; description: string | null; obstacle: string | null }>(
    "select kind, code, published_cause, description, obstacle from h_incidents where user_id = $1 and horse_id = $2",
    [userId, horseId],
  );
  const episodes = await sql.query<{ id: string; documented_reason: string | null; episode_key: string }>(
    "select id, documented_reason, episode_key from h_episodes where user_id = $1 and horse_id = $2",
    [userId, horseId],
  );
  const episodeViews = [];
  for (const episode of episodes) {
    const events = await sql.query<{ kind: string; event_at: string | Date | null; note: string | null }>(
      "select kind, event_at, note from h_episode_events where episode_id = $1 order by created_at",
      [episode.id],
    );
    const labels = recoveryLabels(episode.documented_reason, events.map((event) => ({ kind: event.kind, eventAt: iso(event.event_at) })));
    const announced = labels.returnLabel === "Retorno não informado" ? null : labels.returnLabel;
    episodeViews.push({
      key: episode.episode_key,
      ...labels,
      events: events.map((event) => ({ kind: event.kind, eventAt: iso(event.event_at), note: event.note })),
      comeback: runsAfterReturn(
        history.map((run) => ({ offAt: run.offAt, started: run.started, position: run.position, race: run.race })),
        announced,
      ),
    });
  }
  const realRuns = history.filter((run) => run.origin !== "example");
  const partnerships = {
    jockey: rateRows(realRuns.map((run) => ({ label: run.jockey ?? "Jóquei não informado", started: run.started, won: run.position === 1 }))),
    trainer: rateRows(realRuns.map((run) => ({ label: run.trainer ?? "Treinador não informado", started: run.started, won: run.position === 1 }))),
  };
  const conditions = {
    going: rateRows(realRuns.map((run) => ({ label: run.going ?? "terreno não informado", started: run.started, won: run.position === 1 }))),
    distance: rateRows(realRuns.map((run) => ({ label: distanceBand(run.distanceM), started: run.started, won: run.position === 1 }))),
  };
  const measures = await sql.query<{ attr: string; value_num: string | number | null; unit: string | null; observed_at: string | Date | null }>(
    "select attr, value_num, unit, observed_at from h_observations where user_id = $1 and entity_id = $2 order by observed_at nulls last",
    [userId, horseId],
  );
  return {
    id: horse.id,
    key: horse.entity_key,
    name: horse.name,
    country: horse.country,
    origin: horse.origin,
    foaledYear: horse.foaled_year,
    runs: history,
    longshot: longshotRecord(realStarts),
    incidents: incidents.map((incident) => ({
      kind: incident.kind,
      code: incident.code,
      obstacle: incident.obstacle,
      description: incident.description,
      cause: incidentCause(incident.published_cause),
    })),
    episodes: episodeViews,
    partnerships,
    conditions,
    speed: {
      note: measures.length ? "Medições importadas. Não é uma curva inventada." : "Sem parciais importadas. Não há série de velocidade.",
      points: measures.map((row) => ({ attr: row.attr, value: num(row.value_num), unit: row.unit, observedAt: iso(row.observed_at) })),
    },
  };
}

export async function personProfile(sql: Queryable, userId: string, personId: string) {
  const people = await sql.query<{ id: string; name: string; kind: string; origin: string; country: string | null }>(
    "select id, name, kind, origin, country from h_entities where id = $1 and user_id = $2 and kind in ('jockey', 'trainer')",
    [personId, userId],
  );
  const person = people[0];
  if (!person) return null;
  const column = person.kind === "jockey" ? "jockey_id" : "trainer_id";
  const runs = await runsFor(sql, userId, column, personId);
  const real = runs.filter((run) => run.origin !== "example" && run.started);
  const wins = real.filter((run) => num(run.position) === 1).length;
  return {
    id: person.id,
    name: person.name,
    kind: person.kind,
    country: person.country,
    origin: person.origin,
    sample: real.length,
    wins,
    rate: real.length ? wins / real.length : null,
    health: "Disponibilidade só quando houver publicação oficial. Não há ficha clínica.",
    runs: runs.map((run) => ({
      race: run.race_name,
      offAt: iso(run.off_at),
      course: run.course,
      position: num(run.position),
      origin: run.origin,
      horseId: run.horse_id,
    })),
  };
}

export async function archiveRace(sql: Queryable, userId: string, raceId: string) {
  const races = await sql.query<{ id: string; name: string; off_at: string | Date; going: string | null; distance_m: number | null; origin: string; weather_forecast: string | null; weather_observed: string | null; status: string; course: string | null }>(
    `select a.id, a.name, a.off_at, a.going, a.distance_m, a.origin, a.weather_forecast, a.weather_observed, a.status, c.name as course
       from h_races a left join h_courses c on c.id = a.course_id
      where a.id = $1 and a.user_id = $2`,
    [raceId, userId],
  );
  const race = races[0];
  if (!race) return null;
  const runners = await sql.query<{ id: string; name: string; position: number | null; started: boolean; carried_lb: string | number | null; body_kg: string | number | null; comment: string | null }>(
    `select r.id, e.name, r.position, r.started, r.carried_lb, r.body_kg, r.comment
       from h_runners r join h_entities e on e.id = r.horse_id
      where r.race_id = $1 and r.user_id = $2 order by r.cloth nulls last, e.name`,
    [raceId, userId],
  );
  const prices = await pricesFor(sql, userId, runners.map((runner) => runner.id));
  return {
    id: race.id,
    name: race.name,
    offAt: iso(race.off_at),
    course: race.course,
    going: race.going,
    distanceM: num(race.distance_m),
    origin: race.origin,
    status: race.status,
    before: { weatherForecast: race.weather_forecast, note: "O que podia ser conhecido antes está nas cotações com hora observada anterior à largada." },
    after: { weatherObserved: race.weather_observed, note: "Resultado, comentário e clima observado não entram numa previsão desta corrida." },
    runners: runners.map((runner) => {
      const own = prices.filter((price) => price.runner_id === runner.id);
      const pre = own.filter((price) => price.kind === "preoff");
      const sp = own.find((price) => price.kind === "sp");
      return {
        id: runner.id,
        name: runner.name,
        started: runner.started,
        position: num(runner.position),
        carriedLb: num(runner.carried_lb),
        bodyKg: num(runner.body_kg),
        comment: runner.comment,
        preoff: pre.map((price) => ({ book: price.book, decimal: Number(price.decimal_odds), observedAt: iso(price.observed_at), currency: price.currency })),
        sp: sp ? { decimal: Number(sp.decimal_odds), observedAt: iso(sp.observed_at) } : null,
      };
    }),
  };
}

export async function listArchive(sql: Queryable, userId: string, filter: { q?: string; country?: string; going?: string; limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(filter.limit ?? 20, 1), 50);
  const offset = Math.max(filter.offset ?? 0, 0);
  const like = filter.q ? `%${filter.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%` : null;
  const country = filter.country?.trim() ? filter.country.trim() : null;
  const going = filter.going?.trim() ? filter.going.trim() : null;
  const where = `user_id = $1
      and ($2::text is null or name ilike $2 or exists (
        select 1 from h_runners r join h_entities e on e.id = r.horse_id where r.race_id = a.id and e.name ilike $2))
      and ($3::text is null or country ilike $3)
      and ($4::text is null or going ilike $4)`;
  const total = await sql.query<{ n: number }>(`select count(*)::int as n from h_races a where ${where}`, [userId, like, country, going]);
  const races = await sql.query<{ id: string; name: string; off_at: string | Date; origin: string; country: string | null; going: string | null }>(
    `select id, name, off_at, origin, country, going from h_races a where ${where} order by off_at desc limit $5 offset $6`,
    [userId, like, country, going, limit, offset],
  );
  return { total: Number(total[0]?.n ?? 0), limit, offset, races: races.map((race) => ({ ...race, off_at: iso(race.off_at) })) };
}

export async function coverageReport(sql: Queryable, userId: string) {
  const rows = await sql.query<{ field_name: string; filled: number; missing: number; computed_at: string | Date }>(
    `select distinct on (field_name) field_name, filled, missing, computed_at
       from h_coverage where user_id = $1 order by field_name, computed_at desc`,
    [userId],
  );
  const imports = await sql.query<{ n: number }>("select count(*)::int as n from h_imports where user_id = $1", [userId]);
  return {
    imports: Number(imports[0]?.n ?? 0),
    fields: rows.map((row) => ({ field: row.field_name, filled: Number(row.filled), missing: Number(row.missing), computedAt: iso(row.computed_at) })),
    provider: "Nenhum feed externo está ligado. A última cobertura é a da última importação, não uma cotação ao vivo.",
  };
}

export async function runCycle(sql: Queryable, userId: string, raceId: string, serverNow = new Date().toISOString()) {
  const card = await archiveRace(sql, userId, raceId);
  if (!card || !card.offAt) return { ok: false as const, reason: "A corrida não está no arquivo." };
  const verified = Date.parse(serverNow) < Date.parse(card.offAt);
  const body = {
    raceId,
    serverNow,
    runners: card.runners.map((runner) => ({
      id: runner.id,
      carriedLb: runner.carriedLb,
      bodyKg: runner.bodyKg,
      preoff: runner.preoff,
    })),
  };
  await sql.query(
    `insert into h_snapshots (id, user_id, race_id, taken_at, kind, verified_preoff, content_hash, body)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [randomUUID(), userId, raceId, serverNow, verified ? "preoff" : "late", verified, contentHash(body), JSON.stringify(body)],
  );
  return {
    ok: true as const,
    verifiedPreoff: verified,
    hash: contentHash(body),
    steps: [
      "Identidades já gravadas foram mantidas.",
      verified ? "Snapshot anterior à largada." : "O relógio do servidor já passou a largada. Isto não fica como previsão verificada.",
      "Sem feed: condições e preços não foram actualizados de uma fonte externa.",
      "Resultados só entram por importação. Nada foi inventado.",
    ],
  };
}

const MODEL_KEYS = featureAllowList();

export async function trainExperimental(sql: Queryable, userId: string) {
  const races = await sql.query<{ id: string; off_at: string | Date; origin: string }>(
    "select id, off_at, origin from h_races where user_id = $1 and origin <> 'example' order by off_at, id",
    [userId],
  );
  if (races.length < 5) {
    return { ok: false as const, status: "experimental" as const, reason: "Amostra real insuficiente. O exemplo não entra no treino e não há acurácia para anunciar.", n: races.length };
  }
  const ordered = races.map((race) => ({ id: race.id, offAt: iso(race.off_at)! }));
  const trainEnd = ordered[Math.floor(ordered.length * 0.6)]!.offAt;
  const testStart = ordered[Math.floor(ordered.length * 0.8)]!.offAt;
  const runnerRows = await sql.query<{
    id: string;
    race_id: string;
    horse_id: string;
    position: number | null;
    started: boolean;
    off_at: string | Date;
    course: string | null;
    distance_m: number | null;
    going: string | null;
    jockey_key: string | null;
    trainer_key: string | null;
  }>(
    `select r.id, r.race_id, r.horse_id, r.position, r.started, a.off_at, c.name as course, a.distance_m, a.going, j.entity_key as jockey_key, t.entity_key as trainer_key
       from h_runners r
       join h_races a on a.id = r.race_id
       left join h_courses c on c.id = a.course_id
       left join h_entities j on j.id = r.jockey_id
       left join h_entities t on t.id = r.trainer_id
      where r.user_id = $1 and a.origin <> 'example'`,
    [userId],
  );
  const priceRows = await pricesFor(sql, userId, runnerRows.map((row) => row.id));
  const byHorse = new Map<string, PriorRun[]>();
  for (const row of runnerRows) {
    const list = byHorse.get(row.horse_id) ?? [];
    const own = priceRows.filter((price) => price.runner_id === row.id);
    const timed = timedPreoff(own, iso(row.off_at)!);
    list.push({
      offAt: iso(row.off_at)!,
      started: row.started,
      position: num(row.position),
      course: row.course,
      distanceM: num(row.distance_m),
      going: row.going,
      jockeyKey: row.jockey_key,
      trainerKey: row.trainer_key,
      preoff: timed && !timed.mixed ? timed.decimal : null,
    });
    byHorse.set(row.horse_id, list);
  }
  const samples: { raceId: string; offAt: string; y: number; place: number; x: number[]; runnerId: string }[] = [];
  for (const row of runnerRows) {
    if (!row.started || row.position == null) continue;
    const offAt = iso(row.off_at)!;
    const own = priceRows.filter((price) => price.runner_id === row.id);
    const timed = timedPreoff(own, offAt);
    const features = featuresAt(byHorse.get(row.horse_id) ?? [], offAt, {
      jockeyKey: row.jockey_key,
      trainerKey: row.trainer_key,
      course: row.course,
      distanceM: num(row.distance_m),
      going: row.going,
      preoff: timed && !timed.mixed ? timed.decimal : null,
    });
    for (const key of MODEL_KEYS) {
      await sql.query(
        `insert into h_features (id, user_id, runner_id, feature_key, value_num, as_of, version, cutoff_ok)
         values ($1,$2,$3,$4,$5,$6,'features-1', true)`,
        [randomUUID(), userId, row.id, key, features[key], offAt],
      );
    }
    samples.push({
      raceId: row.race_id,
      offAt,
      y: row.position === 1 ? 1 : 0,
      place: row.position <= 3 ? 1 : 0,
      x: vectorFrom(features, MODEL_KEYS),
      runnerId: row.id,
    });
  }
  const foldInput = ordered.map((race) => ({ id: race.id, offAt: race.offAt, runners: samples.filter((sample) => sample.raceId === race.id).map((sample) => sample.runnerId) }));
  const folds = foldWholeRaces(foldInput, trainEnd, testStart);
  const train = samples.filter((sample) => folds.train.some((race) => race.id === sample.raceId));
  const test = samples.filter((sample) => folds.test.some((race) => race.id === sample.raceId));
  if (train.length < 4 || test.length < 1) {
    return { ok: false as const, status: "experimental" as const, reason: "A partição temporal não tem teste. Nada foi promovido.", n: samples.length };
  }
  const model = fitLogistic(train.map((sample) => sample.x), train.map((sample) => sample.y));
  const scoredPairs = test.map((sample) => ({ p: predictLogistic(model, sample.x), y: sample.y }));
  const scored = binaryScores(scoredPairs);
  const plainTrain = train.map((sample) => withoutMarket(MODEL_KEYS, sample.x).row);
  const plain = fitLogistic(plainTrain, train.map((sample) => sample.y));
  const withoutMarketScores = binaryScores(test.map((sample) => ({ p: predictLogistic(plain, withoutMarket(MODEL_KEYS, sample.x).row), y: sample.y })));
  const placeModel = fitLogistic(train.map((sample) => sample.x), train.map((sample) => sample.place));
  const place = binaryScores(test.map((sample) => ({ p: predictLogistic(placeModel, sample.x), y: sample.place })));
  const marketPairs = test
    .map((sample) => {
      const implied = sample.x[MODEL_KEYS.indexOf("implied_prob")] ?? 0;
      return implied > 0 ? { p: implied, y: sample.y } : null;
    })
    .filter((pair): pair is { p: number; y: number } => pair != null);
  const market = binaryScores(marketPairs);
  const bins = reliabilityBins(scoredPairs);
  const decision = promotionDecision({ prospectivePass: false, testN: scored.n });
  const version = `exp-${Date.now()}`;
  const metrics = {
    model: scored,
    withoutMarket: withoutMarketScores,
    place,
    market,
    reliability: bins,
    trainEnd,
    testStart,
    note: "Participantes sem posição ficam de fora. Não conclusão não é lesão. Brier é binário, 0 a 1, por participante.",
  };
  await sql.query(
    `insert into h_models (id, user_id, model_key, version, status, family, params, metrics)
     values ($1,$2,'win-logistic',$3,$4,$5,$6::jsonb,$7::jsonb)`,
    [
      randomUUID(),
      userId,
      version,
      decision.status,
      model.family,
      JSON.stringify({ keys: MODEL_KEYS, weights: model.w, bias: model.b, withoutMarketKeys: withoutMarket(MODEL_KEYS, train[0]?.x ?? []).keys }),
      JSON.stringify(metrics),
    ],
  );
  return {
    ok: true as const,
    status: decision.status,
    reason: decision.reason,
    model: scored,
    withoutMarket: withoutMarketScores,
    place,
    market,
    reliability: bins,
    trainEnd,
    testStart,
    version,
  };
}
