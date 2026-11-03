import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { bookMetrics, importCard, listRaces, recordPrediction, recordResult } from "./ledger.ts";

const migration = readFileSync(new URL("../../../migrations/0002_turf.sql", import.meta.url), "utf8");

const card = {
  races: [
    {
      providerRaceId: "race-1",
      course: "Naas",
      country: "IE",
      discipline: "Hurdle",
      name: "Maiden Hurdle",
      offAt: "2026-12-01T15:00:00.000Z",
      handicap: false,
      runners: [
        { name: "Alpha", horseKey: "h1", providerRunnerId: "h1", jockey: "Paul Townend", goingRuns: [{ offAt: "2026-10-01T15:00:00.000Z", course: "Naas", position: 1 }] },
        { name: "Beta", horseKey: "h2", providerRunnerId: "h2" },
      ],
      prices: [
        { runnerKey: "h1", market: "WIN", book: "casa", decimal: 3, observedAt: "2026-12-01T14:00:00.000Z" },
        { runnerKey: "h2", market: "WIN", book: "casa", decimal: 4, observedAt: "2026-12-01T14:00:00.000Z" },
      ],
    },
  ],
};

async function db() {
  const pg = new PGlite();
  await pg.exec(migration);
  return {
    query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows,
  };
}

test("the schema does not rewrite a prediction", () => {
  assert.equal(/update\s+turf_predictions/i.test(migration), false);
});

test("a user book starts empty, keeps imports apart, and refuses a late prediction", async () => {
  const sql = await db();
  const empty = await listRaces(sql, "user-a", {});
  assert.equal(empty.races.length, 0);
  const imported = await importCard(sql, "user-a", card, "batch-1");
  assert.equal(imported.ok && imported.imported, 1);
  const replay = await importCard(sql, "user-a", card, "batch-1");
  assert.equal(replay.ok && replay.replay, true);
  const other = await listRaces(sql, "user-b", {});
  assert.equal(other.races.length, 0);
  const mine = await listRaces(sql, "user-a", { country: "IE" });
  assert.equal(mine.races.length, 1);
  assert.equal(mine.races[0]?.origin, "user");
  const byJockey = await listRaces(sql, "user-a", { q: "Townend" });
  assert.equal(byJockey.races.length, 1);
  const nobody = await listRaces(sql, "user-a", { q: "Ninguem" });
  assert.equal(nobody.races.length, 0);
  const raceId = mine.races[0]!.id;
  const stored = await sql.query<{ profile: { goingRuns?: unknown[] } | string }>(
    "select profile from turf_runners where user_id = $1 and race_id = $2 and name = 'Alpha'",
    ["user-a", raceId],
  );
  const profile = typeof stored[0]?.profile === "string" ? JSON.parse(stored[0].profile) : stored[0]?.profile;
  assert.equal(profile.goingRuns.length, 1);
  const synthetic = await importCard(sql, "user-a", { races: [{ origin: "synthetic" }] }, "bad");
  assert.equal(synthetic.ok, false);
  const runners = await sql.query<{ id: string; name: string }>(
    "select id, name from turf_runners where user_id = $1 and race_id = $2 order by name",
    ["user-a", raceId],
  );
  const probabilities = runners.map((runner, index) => ({ runnerId: runner.id, p: index === 0 ? 0.6 : 0.4 }));
  const first = await recordPrediction(sql, "user-a", {
    raceId,
    idempotencyKey: "pred-1",
    modelId: "import",
    modelVersion: "1",
    parameters: { note: "distribuição informada, não validada" },
    probabilities,
    pickRunnerId: runners[0]!.id,
    serverNow: "2026-12-01T14:30:00.000Z",
  });
  assert.equal(first.ok && first.qualified, false);
  const again = await recordPrediction(sql, "user-a", {
    raceId,
    idempotencyKey: "pred-1",
    modelId: "import",
    modelVersion: "1",
    parameters: { note: "distribuição informada, não validada" },
    probabilities,
    pickRunnerId: runners[0]!.id,
    serverNow: "2026-12-01T14:30:00.000Z",
  });
  assert.equal(again.ok && again.replay, true);
  const late = await recordPrediction(sql, "user-a", {
    raceId,
    idempotencyKey: "pred-late",
    modelId: "import",
    modelVersion: "2",
    parameters: {},
    probabilities,
    pickRunnerId: runners[0]!.id,
    serverNow: "2026-12-01T15:00:00.000Z",
  });
  assert.equal(late.ok, false);
  const blank = await bookMetrics(sql, "user-a");
  assert.equal(blank.roi, null);
  await recordResult(sql, "user-a", {
    raceId,
    idempotencyKey: "res-1",
    status: "official",
    source: "user",
    payload: {
      runners: [
        { runnerId: runners[0]!.id, position: 1 },
        { runnerId: runners[1]!.id, position: 2 },
      ],
      close: [{ runnerId: runners[0]!.id, book: "casa", market: "WIN", decimal: 3.5, kind: "official-sp" }],
    },
  });
  const scored = await bookMetrics(sql, "user-a");
  assert.equal(scored.hitN, 1);
  assert.equal(scored.roiN, 1);
  assert.equal(scored.predictions, 1);
  const foreign = await recordPrediction(sql, "user-b", {
    raceId,
    idempotencyKey: "pred-b",
    modelId: "import",
    modelVersion: "1",
    parameters: {},
    probabilities,
    pickRunnerId: runners[0]!.id,
    serverNow: "2026-12-01T14:30:00.000Z",
  });
  assert.equal(foreign.ok, false);
});
