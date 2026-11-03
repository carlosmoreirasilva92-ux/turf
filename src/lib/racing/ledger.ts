import { randomUUID } from "node:crypto";
import { quotaDecision } from "./ai-guard.ts";
import { parseImport, type ImportedRace } from "./import-card.ts";
import { summarize, type MetricRow } from "./metrics.ts";
import { readPerspectives, RULES_VERSION, type PricePoint, type RaceView, type RunnerView } from "./perspectives.ts";
import { EXPERIMENTAL } from "./qualify.ts";
import { buildSnapshot, checkDistribution, planRecording, sameWrite } from "./snapshot.ts";
import type { WinLeg } from "./settlement.ts";

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

type RaceRow = {
  id: string;
  course: string;
  country: string;
  discipline: string;
  name: string;
  distance: string | null;
  going: string | null;
  off_at: string | Date;
  handicap: boolean;
  origin: string;
};

type RunnerRow = {
  id: string;
  horse_key: string | null;
  name: string;
  cloth: number | null;
  jockey_name: string | null;
  trainer_name: string | null;
  profile: RunnerProfile | string;
};

type RunnerProfile = {
  form?: string;
  weightLb?: number | null;
  or?: number | null;
  goingRuns?: RunnerView["goingRuns"];
  trainer?: RunnerView["trainer"];
  jockey?: RunnerView["jockey"];
};

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function profileOf(raw: RunnerRow["profile"]): RunnerProfile {
  if (typeof raw === "string") return JSON.parse(raw) as RunnerProfile;
  return raw ?? {};
}

export async function importCard(sql: Queryable, userId: string, body: unknown, importKey: string) {
  const parsed = parseImport(body);
  if ("errors" in parsed) return { ok: false as const, errors: parsed.errors };
  const prior = await sql.query<{ id: string }>(
    "select id from turf_sync_runs where user_id = $1 and detail->>'importKey' = $2 and status = 'ok' limit 1",
    [userId, importKey],
  );
  if (prior[0]) return { ok: true as const, replay: true, imported: 0, skipped: parsed.races.length, syncId: prior[0].id };
  const syncId = randomUUID();
  await sql.query(
    "insert into turf_sync_runs (id, user_id, source, status, detail) values ($1, $2, 'user', 'open', $3::jsonb)",
    [syncId, userId, JSON.stringify({ importKey })],
  );
  let imported = 0;
  let skipped = 0;
  for (const race of parsed.races) {
    const wrote = await insertRace(sql, userId, race);
    if (wrote) imported += 1;
    else skipped += 1;
  }
  await sql.query(
    "update turf_sync_runs set status = 'ok', finished_at = now(), detail = $2::jsonb where id = $1",
    [syncId, JSON.stringify({ importKey, imported, skipped })],
  );
  return { ok: true as const, replay: false, imported, skipped, syncId };
}

async function insertRace(sql: Queryable, userId: string, race: ImportedRace): Promise<boolean> {
  if (race.providerRaceId) {
    const existing = await sql.query<{ id: string }>(
      "select id from turf_races where user_id = $1 and provider_race_id = $2 limit 1",
      [userId, race.providerRaceId],
    );
    if (existing[0]) return false;
  }
  const raceId = randomUUID();
  await sql.query(
    `insert into turf_races
      (id, user_id, provider_race_id, course, country, discipline, name, distance, going, off_at, handicap, origin)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'user')`,
    [raceId, userId, race.providerRaceId, race.course, race.country, race.discipline, race.name, race.distance, race.going, race.offAt, race.handicap],
  );
  const runnerIds = new Map<string, string>();
  for (const runner of race.runners) {
    const id = randomUUID();
    const key = runner.horseKey ?? runner.providerRunnerId ?? id;
    runnerIds.set(key, id);
    if (runner.providerRunnerId) runnerIds.set(runner.providerRunnerId, id);
    await sql.query(
      `insert into turf_runners
        (id, user_id, race_id, provider_runner_id, horse_key, name, cloth, jockey_name, jockey_key, trainer_name, trainer_key, profile)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [
        id, userId, raceId, runner.providerRunnerId, runner.horseKey, runner.name, runner.cloth, runner.jockey, runner.jockeyKey, runner.trainer, runner.trainerKey,
        JSON.stringify({
          form: runner.form,
          weightLb: runner.weightLb,
          or: runner.or,
          goingRuns: runner.goingRuns,
          trainer: runner.trainerHistory,
          jockey: runner.jockeyHistory,
        }),
      ],
    );
  }
  for (const price of race.prices) {
    const runnerId = runnerIds.get(price.runnerKey);
    if (!runnerId) continue;
    await sql.query(
      `insert into turf_prices
        (id, user_id, race_id, runner_id, market, book, decimal_odds, source, observed_at, provider_updated_at, received_at)
       values ($1,$2,$3,$4,$5,$6,$7,'user',$8,$9, now())`,
      [randomUUID(), userId, raceId, runnerId, price.market, price.book, price.decimal, price.observedAt, price.providerUpdatedAt],
    );
  }
  return true;
}

function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

export async function listRaces(
  sql: Queryable,
  userId: string,
  filter: { q?: string; country?: string; discipline?: string; limit?: number; before?: string | null },
) {
  const limit = Math.min(Math.max(filter.limit ?? 20, 1), 50);
  const rows = await sql.query<RaceRow & { runner_count: number | string; favorite: boolean }>(
    `select r.id, r.course, r.country, r.discipline, r.name, r.distance, r.going, r.off_at, r.handicap, r.origin,
            (select count(*)::int from turf_runners n where n.race_id = r.id and n.user_id = r.user_id) as runner_count,
            exists (select 1 from turf_favorites f where f.user_id = r.user_id and f.race_id = r.id) as favorite
       from turf_races r
      where r.user_id = $1
        and ($2::text is null or r.country = $2)
        and ($3::text is null or r.discipline = $3)
        and (
          $4::text is null
          or r.course ilike $4
          or r.name ilike $4
          or exists (
            select 1 from turf_runners n
             where n.race_id = r.id
               and n.user_id = r.user_id
               and (
                 n.name ilike $4
                 or coalesce(n.jockey_name, '') ilike $4
                 or coalesce(n.trainer_name, '') ilike $4
               )
          )
        )
        and ($5::timestamptz is null or r.off_at < $5)
      order by r.off_at desc, r.id desc
      limit $6`,
    [
      userId,
      filter.country || null,
      filter.discipline || null,
      filter.q ? likePattern(filter.q) : null,
      filter.before ?? null,
      limit + 1,
    ],
  );
  const page = rows.slice(0, limit);
  return {
    races: page.map((race) => ({
      ...race,
      off_at: iso(race.off_at),
      origin: race.origin,
      runner_count: Number(race.runner_count),
      favorite: Boolean(race.favorite),
    })),
    next: rows.length > limit ? iso(page[page.length - 1]!.off_at) : null,
  };
}

async function loadRace(sql: Queryable, userId: string, raceId: string) {
  const races = await sql.query<RaceRow>(
    "select id, course, country, discipline, name, distance, going, off_at, handicap, origin from turf_races where id = $1 and user_id = $2",
    [raceId, userId],
  );
  const race = races[0];
  if (!race) return null;
  const runners = await sql.query<RunnerRow>(
    "select id, horse_key, name, cloth, jockey_name, trainer_name, profile from turf_runners where race_id = $1 and user_id = $2 order by cloth nulls last, name",
    [raceId, userId],
  );
  const prices = await sql.query<{
    id: string;
    runner_id: string;
    market: string;
    book: string;
    decimal_odds: string | number;
    observed_at: string | Date | null;
    received_at: string | Date;
  }>(
    "select id, runner_id, market, book, decimal_odds, observed_at, received_at from turf_prices where race_id = $1 and user_id = $2 order by received_at desc",
    [raceId, userId],
  );
  return { race, runners, prices };
}

export async function recordPrediction(
  sql: Queryable,
  userId: string,
  input: {
    raceId: string;
    idempotencyKey: string;
    modelId: string;
    modelVersion: string;
    parameters: Record<string, unknown>;
    probabilities: { runnerId: string; p: number }[];
    pickRunnerId: string | null;
    serverNow?: string;
  },
) {
  const loaded = await loadRace(sql, userId, input.raceId);
  if (!loaded) return { ok: false as const, reason: "A corrida não está neste livro." };
  if (loaded.race.origin !== "user" && loaded.race.origin !== "provider") return { ok: false as const, reason: "Origem recusada." };
  const serverNow = input.serverNow ?? new Date().toISOString();
  const offAt = iso(loaded.race.off_at);
  const timing = planRecording({ serverNow, offAt });
  if (!timing.ok) return { ok: false as const, reason: timing.reason };
  const ids = loaded.runners.map((runner) => runner.id);
  const distribution = checkDistribution(ids, input.probabilities);
  if (!distribution.ok) return { ok: false as const, reason: distribution.reason };
  if (input.pickRunnerId && !ids.includes(input.pickRunnerId)) return { ok: false as const, reason: "O indicado não está na corrida." };
  const latestPrice = new Map<string, (typeof loaded.prices)[number]>();
  for (const price of [...loaded.prices].reverse()) latestPrice.set(price.runner_id, price);
  const perspectives = readPerspectives(toView(loaded, serverNow, input.pickRunnerId, latestPrice));
  const snapshot = buildSnapshot({
    raceId: input.raceId,
    offAt,
    serverNow,
    modelId: input.modelId,
    modelVersion: input.modelVersion,
    parameters: input.parameters,
    runners: input.probabilities,
    pickRunnerId: input.pickRunnerId,
    prices: [...latestPrice.entries()].map(([runnerId, price]) => ({
      runnerId,
      priceId: price.id,
      book: price.book,
      decimal: Number(price.decimal_odds),
      observedAt: price.observed_at ? iso(price.observed_at) : null,
    })),
    perspectives,
    perspectiveVersion: RULES_VERSION,
    validation: EXPERIMENTAL,
  });
  const existing = await sql.query<{ idempotency_key: string; content_hash: string; id: string }>(
    "select id, idempotency_key, content_hash from turf_predictions where user_id = $1 and (idempotency_key = $2 or (race_id = $3 and model_version = $4)) limit 1",
    [userId, input.idempotencyKey, input.raceId, input.modelVersion],
  );
  const decision = sameWrite(
    existing[0] ? { idempotencyKey: existing[0].idempotency_key, hash: existing[0].content_hash } : null,
    { idempotencyKey: input.idempotencyKey, hash: snapshot.hash },
  );
  if (decision === "replay") return { ok: true as const, replay: true, id: existing[0]!.id, hash: snapshot.hash, qualified: false };
  if (decision === "conflict") return { ok: false as const, reason: "Já existe um registo diferente para esta corrida ou esta chave." };
  const id = randomUUID();
  try {
    await sql.query(
      `insert into turf_predictions
        (id, user_id, race_id, idempotency_key, model_id, model_version, content_hash, snapshot, server_now, off_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
      [id, userId, input.raceId, input.idempotencyKey, input.modelId, input.modelVersion, snapshot.hash, JSON.stringify(snapshot), serverNow, offAt],
    );
  } catch {
    const again = await sql.query<{ id: string; content_hash: string }>(
      "select id, content_hash from turf_predictions where user_id = $1 and idempotency_key = $2 limit 1",
      [userId, input.idempotencyKey],
    );
    if (again[0]?.content_hash === snapshot.hash) return { ok: true as const, replay: true, id: again[0].id, hash: snapshot.hash, qualified: false };
    return { ok: false as const, reason: "Já existe um registo diferente para esta corrida ou esta chave." };
  }
  return { ok: true as const, replay: false, id, hash: snapshot.hash, qualified: snapshot.qualified };
}

function toView(
  loaded: NonNullable<Awaited<ReturnType<typeof loadRace>>>,
  now: string,
  pickRunnerId: string | null,
  prices: Map<string, { book: string; market: string; decimal_odds: string | number; observed_at: string | Date | null; received_at: string | Date }>,
): RaceView {
  const runners: RunnerView[] = loaded.runners.map((runner) => {
    const profile = profileOf(runner.profile);
    const price = prices.get(runner.id);
    const point: PricePoint | null =
      price && price.market === "WIN"
        ? {
            book: price.book,
            market: "WIN",
            decimal: Number(price.decimal_odds),
            observedAt: price.observed_at ? iso(price.observed_at) : null,
            receivedAt: iso(price.received_at),
          }
        : null;
    return {
      key: runner.id,
      name: runner.name,
      cloth: runner.cloth ?? 0,
      form: profile.form ?? "",
      goingRuns: profile.goingRuns ?? [],
      trainer: profile.trainer ?? null,
      jockey: profile.jockey ?? null,
      or: profile.or ?? null,
      weightLb: profile.weightLb ?? null,
      price: point,
    };
  });
  return {
    offAt: iso(loaded.race.off_at),
    now,
    going: loaded.race.going ?? "",
    course: loaded.race.course,
    distance: loaded.race.distance ?? "",
    handicap: loaded.race.handicap,
    handicapEvidence: loaded.race.handicap ? "declared" : "none",
    runners,
    pickKey: pickRunnerId,
  };
}

export async function recordResult(
  sql: Queryable,
  userId: string,
  input: { raceId: string; idempotencyKey: string; status: string; payload: unknown; source: "user" | "provider" },
) {
  const allowed = new Set(["provisional", "official", "amended", "void", "abandoned"]);
  if (!allowed.has(input.status)) return { ok: false as const, reason: "Estado de resultado desconhecido." };
  const race = await sql.query<{ id: string }>("select id from turf_races where id = $1 and user_id = $2", [input.raceId, userId]);
  if (!race[0]) return { ok: false as const, reason: "A corrida não está neste livro." };
  const id = randomUUID();
  const inserted = await sql.query<{ id: string }>(
    `insert into turf_result_events (id, user_id, race_id, idempotency_key, status, payload, source)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7)
     on conflict (user_id, idempotency_key) do nothing
     returning id`,
    [id, userId, input.raceId, input.idempotencyKey, input.status, JSON.stringify(input.payload), input.source],
  );
  return { ok: true as const, replay: inserted.length === 0, id: inserted[0]?.id ?? id };
}

type PredictionRow = { id: string; race_id: string; snapshot: SnapshotJson | string; off_at: string | Date };
type SnapshotJson = {
  runners: { runnerId: string; p: number }[];
  pickRunnerId: string | null;
  prices: { runnerId: string; book: string; decimal: number; observedAt: string | null }[];
};
type ResultRow = { race_id: string; status: string; payload: ResultPayload | string; created_at: string | Date };
type ResultPayload = {
  runners?: { runnerId: string; position: number | null; nonRunner?: boolean }[];
  deductions?: { runnerId: string; rate: number }[];
  close?: { runnerId: string; book: string; market: string; decimal: number; kind: "official-sp" | "observed-close" }[];
};

function json<T>(value: T | string): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}

export async function bookMetrics(sql: Queryable, userId: string) {
  const predictions = await sql.query<PredictionRow>(
    "select id, race_id, snapshot, off_at from turf_predictions where user_id = $1 order by off_at, id",
    [userId],
  );
  const results = await sql.query<ResultRow>(
    "select race_id, status, payload, created_at from turf_result_events where user_id = $1 order by created_at",
    [userId],
  );
  const latest = new Map<string, ResultRow>();
  for (const result of results) latest.set(result.race_id, result);
  const rows: MetricRow[] = [];
  for (const prediction of predictions) {
    const result = latest.get(prediction.race_id);
    const snapshot = json<SnapshotJson>(prediction.snapshot);
    const probs = snapshot.runners.map((row) => ({ key: row.runnerId, p: row.p }));
    if (!result || result.status === "provisional") {
      rows.push({ probs, winner: null, leg: null, recorded: null, close: null });
      continue;
    }
    const payload = json<ResultPayload>(result.payload);
    const pick = snapshot.pickRunnerId;
    const recordedPrice = snapshot.prices.find((price) => price.runnerId === pick);
    if (result.status === "void" || result.status === "abandoned") {
      rows.push({ probs, winner: null, leg: pick && recordedPrice ? voidLeg(recordedPrice.decimal) : null, recorded: null, close: null });
      continue;
    }
    const winners = payload.runners?.filter((runner) => runner.position === 1 && !runner.nonRunner) ?? [];
    const pickResult = payload.runners?.find((runner) => runner.runnerId === pick);
    const deduction = payload.deductions?.find((item) => item.runnerId === pick)?.rate ?? 0;
    const leg: WinLeg | null =
      pick && recordedPrice && pickResult
        ? {
            odds: recordedPrice.decimal,
            won: pickResult.position === 1 && !pickResult.nonRunner,
            deadHeatWinners: Math.max(1, winners.length),
            deduction,
            voided: false,
            nonRunner: Boolean(pickResult.nonRunner),
          }
        : null;
    const close = payload.close?.find((item) => item.runnerId === pick);
    rows.push({
      probs,
      winner: winners.length === 1 ? winners[0]!.runnerId : null,
      leg,
      recorded: recordedPrice && pick ? { book: recordedPrice.book, market: "WIN", runnerKey: pick, decimal: recordedPrice.decimal, kind: "recorded" } : null,
      close: close && pick ? { book: close.book, market: close.market, runnerKey: pick, decimal: close.decimal, kind: close.kind } : null,
    });
  }
  return { ...summarize(rows), predictions: predictions.length, results: results.length };
}

function voidLeg(odds: number): WinLeg {
  return { odds, won: false, deadHeatWinners: 1, deduction: 0, voided: true, nonRunner: false };
}

export async function describeRace(sql: Queryable, userId: string, raceId: string) {
  const loaded = await loadRace(sql, userId, raceId);
  if (!loaded) return null;
  const now = new Date().toISOString();
  const prices = new Map<string, (typeof loaded.prices)[number]>();
  for (const price of [...loaded.prices].reverse()) prices.set(price.runner_id, price);
  return {
    course: loaded.race.course,
    name: loaded.race.name,
    offAt: iso(loaded.race.off_at),
    origin: loaded.race.origin,
    reads: readPerspectives(toView(loaded, now, null, prices)),
  };
}

export async function raceCard(sql: Queryable, userId: string, raceId: string) {
  const loaded = await loadRace(sql, userId, raceId);
  if (!loaded) return null;
  const now = new Date().toISOString();
  const prices = new Map<string, (typeof loaded.prices)[number]>();
  for (const price of [...loaded.prices].reverse()) prices.set(price.runner_id, price);
  const view = toView(loaded, now, null, prices);
  const favorite = await sql.query<{ race_id: string }>(
    "select race_id from turf_favorites where user_id = $1 and race_id = $2",
    [userId, raceId],
  );
  return {
    id: loaded.race.id,
    course: loaded.race.course,
    country: loaded.race.country,
    discipline: loaded.race.discipline,
    name: loaded.race.name,
    distance: loaded.race.distance,
    going: loaded.race.going,
    offAt: iso(loaded.race.off_at),
    handicap: loaded.race.handicap,
    origin: loaded.race.origin,
    favorite: Boolean(favorite[0]),
    runners: view.runners.map((runner) => {
      const row = loaded.runners.find((item) => item.id === runner.key);
      return {
        id: runner.key,
        name: runner.name,
        cloth: runner.cloth,
        jockey: row?.jockey_name ?? null,
        trainer: row?.trainer_name ?? null,
        price: runner.price
          ? {
              book: runner.price.book,
              decimal: runner.price.decimal,
              observedAt: runner.price.observedAt,
              receivedAt: runner.price.receivedAt,
            }
          : null,
      };
    }),
    reads: readPerspectives(view).map((read) => ({
      id: read.id,
      horse: read.horse,
      stance: read.stance,
      note: read.note,
      version: read.version,
    })),
  };
}

export async function beginAiCall(sql: Queryable, userId: string) {
  const id = randomUUID();
  await sql.query("insert into turf_ai_calls (id, user_id, status) values ($1, $2, 'open')", [id, userId]);
  const userHour = await sql.query<{ n: number }>(
    "select count(*)::int as n from turf_ai_calls where user_id = $1 and started_at > now() - interval '1 hour'",
    [userId],
  );
  const globalHour = await sql.query<{ n: number }>("select count(*)::int as n from turf_ai_calls where started_at > now() - interval '1 hour'");
  const open = await sql.query<{ n: number }>("select count(*)::int as n from turf_ai_calls where user_id = $1 and status = 'open'", [userId]);
  const decision = quotaDecision({
    userHour: Number(userHour[0]?.n ?? 1) - 1,
    globalHour: Number(globalHour[0]?.n ?? 1) - 1,
    userOpen: Number(open[0]?.n ?? 1) - 1,
  });
  if (!decision.ok) {
    await sql.query("update turf_ai_calls set status = 'rejected', finished_at = now() where id = $1", [id]);
    return { ok: false as const, reason: decision.reason };
  }
  return { ok: true as const, id };
}

export async function finishAiCall(sql: Queryable, id: string, status: "ok" | "error") {
  await sql.query("update turf_ai_calls set status = $2, finished_at = now() where id = $1", [id, status]);
}

export async function toggleFavorite(sql: Queryable, userId: string, raceId: string) {
  const owned = await sql.query<{ id: string }>("select id from turf_races where id = $1 and user_id = $2", [raceId, userId]);
  if (!owned[0]) return { ok: false as const, reason: "A corrida não está neste livro." };
  const existing = await sql.query<{ race_id: string }>("select race_id from turf_favorites where user_id = $1 and race_id = $2", [userId, raceId]);
  if (existing[0]) {
    await sql.query("delete from turf_favorites where user_id = $1 and race_id = $2", [userId, raceId]);
    return { ok: true as const, favorite: false };
  }
  await sql.query("insert into turf_favorites (user_id, race_id) values ($1, $2)", [userId, raceId]);
  return { ok: true as const, favorite: true };
}

export async function exportBook(sql: Queryable, userId: string) {
  const races = await sql.query<{ id: string; course: string; country: string; name: string; off_at: string | Date; origin: string }>(
    "select id, course, country, name, off_at, origin from turf_races where user_id = $1 order by off_at",
    [userId],
  );
  const runners = await sql.query<{ id: string; race_id: string; name: string; horse_key: string | null }>(
    "select id, race_id, name, horse_key from turf_runners where user_id = $1",
    [userId],
  );
  const prices = await sql.query<{ id: string; race_id: string; runner_id: string; book: string; market: string; decimal_odds: string | number; observed_at: string | Date | null; received_at: string | Date; source: string }>(
    "select id, race_id, runner_id, book, market, decimal_odds, observed_at, received_at, source from turf_prices where user_id = $1",
    [userId],
  );
  const predictions = await sql.query<{ id: string; race_id: string; model_id: string; model_version: string; content_hash: string }>(
    "select id, race_id, model_id, model_version, content_hash from turf_predictions where user_id = $1",
    [userId],
  );
  const results = await sql.query<{ id: string; race_id: string; status: string; source: string }>(
    "select id, race_id, status, source from turf_result_events where user_id = $1",
    [userId],
  );
  return {
    origin: "export" as const,
    note: "Preços e resultados importados pelo utilizador não têm verificação independente. O hash não autentica a fonte.",
    races: races.map((race) => ({ id: race.id, course: race.course, country: race.country, name: race.name, offAt: iso(race.off_at), origin: race.origin })),
    runners: runners.map((runner) => ({ id: runner.id, raceId: runner.race_id, name: runner.name, horseKey: runner.horse_key })),
    prices: prices.map((price) => ({
      id: price.id,
      raceId: price.race_id,
      runnerId: price.runner_id,
      book: price.book,
      market: price.market,
      decimal: Number(price.decimal_odds),
      observedAt: price.observed_at ? iso(price.observed_at) : null,
      receivedAt: iso(price.received_at),
      source: price.source,
    })),
    predictions,
    results,
  };
}
