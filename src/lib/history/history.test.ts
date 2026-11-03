import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { CATALOG } from "./catalog.ts";
import { parseHistoryCsv } from "./csv.ts";
import {
  combineProfits,
  distanceBand,
  featuresAt,
  featureAllowList,
  foldWholeRaces,
  incidentCause,
  longshotRecord,
  marketFlags,
  promotionDecision,
  rateRows,
  readWeights,
  recoveryLabels,
  reliabilityBins,
  runsAfterReturn,
  withoutMarket,
} from "./domain.ts";
import { parseHistoryPack } from "./import-pack.ts";
import { horseProfile, importHistory, listEntities, trainExperimental } from "./store.ts";

const migration = readFileSync(new URL("../../../migrations/0003_history.sql", import.meta.url), "utf8");

async function db() {
  const pg = new PGlite();
  await pg.exec(migration);
  return { query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows };
}

const pack = {
  origin: "user",
  sources: [{ key: "manual", name: "Caderno", kind: "manual" }],
  entities: [
    { kind: "horse", key: "h1", name: "Alpha" },
    { kind: "horse", key: "h2", name: "Alpha" },
    { kind: "horse", key: "h3", name: "Beta" },
    { kind: "jockey", key: "j1", name: "Rui" },
    { kind: "trainer", key: "t1", name: "Nora" },
  ],
  courses: [{ key: "naas", name: "Naas", country: "IE" }],
  races: [
    {
      key: "r1",
      courseKey: "naas",
      name: "Maiden",
      offAt: "2026-06-01T15:00:00.000Z",
      distanceM: 3200,
      going: "Soft",
      runners: [
        { horseKey: "h1", jockeyKey: "j1", trainerKey: "t1", carriedLb: 154, bodyKg: 480, started: true, position: 1, prices: [{ book: "casa", market: "WIN", decimal: 12, kind: "preoff", observedAt: "2026-06-01T14:00:00.000Z", currency: "EUR" }] },
        { horseKey: "h3", jockeyKey: "j1", trainerKey: "t1", carriedLb: 150, started: true, position: 2, prices: [{ book: "casa", market: "WIN", decimal: 3, kind: "preoff", observedAt: "2026-06-01T14:00:00.000Z", currency: "EUR" }] },
      ],
    },
  ],
  incidents: [{ horseKey: "h1", kind: "fall", code: "F", description: "Queda no último", publishedCause: null }],
  episodes: [{ key: "e1", horseKey: "h1", documentedReason: null, events: [{ kind: "entry", eventAt: "2026-07-01T10:00:00.000Z", note: "inscrito" }] }],
  facts: [{ subjectType: "horse", subjectKey: "h1", attr: "colour", value: "bay" }],
};

test("the catalog has 431 unique attributes with a storage path", () => {
  assert.equal(CATALOG.length, 431);
  assert.equal(new Set(CATALOG.map((attr) => attr.key)).size, 431);
  assert.ok(CATALOG.every((attr) => attr.storage && attr.query && attr.input && attr.fill === "vazio-ate-importacao"));
  const banned = new Set(CATALOG.filter((attr) => attr.modelPolicy === "leakage-forbidden").map((attr) => attr.key));
  assert.ok(featureAllowList().every((key) => !banned.has(key)));
});

test("weights, incidents, recovery and longshots stay literal", () => {
  assert.equal(readWeights({ weight: 70 }).ok, false);
  const split = readWeights({ carriedLb: 154, bodyKg: 480 });
  assert.equal(split.ok && split.carriedLb, 154);
  assert.equal(split.ok && split.bodyKg, 480);
  assert.equal(incidentCause(null), "Causa não informada");
  assert.equal(incidentCause("contusão publicada"), "contusão publicada");
  const labels = recoveryLabels(null, [{ kind: "entry", eventAt: "2026-07-01T00:00:00.000Z" }]);
  assert.equal(labels.cause, "Causa não informada");
  assert.equal(labels.returnLabel, "Retorno não informado");
  assert.equal(labels.entryIsClearance, false);
  const starts = Array.from({ length: 18 }, (_, index) => ({
    started: true,
    decimal: 12,
    won: index === 0 || index === 3,
    placed: index < 4,
    field: [12, 4],
  }));
  const record = longshotRecord(starts);
  assert.equal(record.label, "2/18");
  assert.equal(record.wins, 2);
  assert.equal(record.eligible, 18);
  const cheap = marketFlags(3, [3, 12], true, true);
  const dear = marketFlags(12, [3, 12], true, true);
  assert.equal(cheap.favourite, true);
  assert.equal(cheap.longshot, false);
  assert.equal(dear.longshot, true);
  assert.equal(dear.historicalSurprise, true);
  assert.equal(marketFlags(null, [3], false, false).unpriced, true);
});

test("features ignore the future and promotion stays experimental", () => {
  const priors = [
    { offAt: "2026-05-01T15:00:00.000Z", started: true, position: 1, course: "Naas", distanceM: 3200, going: "Soft", jockeyKey: "j1", trainerKey: "t1", preoff: 4 },
    { offAt: "2026-08-01T15:00:00.000Z", started: true, position: 1, course: "Naas", distanceM: 3200, going: "Soft", jockeyKey: "j1", trainerKey: "t1", preoff: 2 },
  ];
  const early = featuresAt(priors, "2026-06-01T15:00:00.000Z", { jockeyKey: "j1", trainerKey: "t1", course: "Naas", distanceM: 3200, going: "Soft", preoff: 12 });
  assert.equal(early.prior_wins, 1);
  assert.equal(early.implied_prob, 1 / 12);
  const same = foldWholeRaces(
    [{ id: "r", offAt: "2026-06-01T15:00:00.000Z", runners: ["a", "b"] }],
    "2026-01-01T00:00:00.000Z",
    "2026-07-01T00:00:00.000Z",
  );
  assert.equal(same.train.length + same.calibrate.length + same.test.length, 1);
  assert.equal(promotionDecision({ prospectivePass: false, testN: 20 }).status, "experimental");
  assert.equal(combineProfits([{ currency: "EUR", profit: 1 }, { currency: "GBP", profit: 1 }]).ok, false);
  const bins = reliabilityBins([{ p: 0.1, y: 0 }, { p: 0.95, y: 1 }]);
  assert.equal(bins[0]?.n, 1);
  assert.equal(bins[4]?.n, 1);
  assert.equal(bins[4]?.observed, 1);
  assert.equal(withoutMarket(["prior_wins", "implied_prob"], [2, 0.2]).keys.join(","), "prior_wins");
  assert.equal(distanceBand(3200), "3200 m ou mais");
  assert.equal(rateRows([{ label: "Rui", started: true, won: true }, { label: "Rui", started: false, won: false }])[0]?.runs, 1);
  assert.equal(runsAfterReturn([{ offAt: "2026-08-01T15:00:00.000Z", started: true, position: 2, race: "M" }], null).label, "Retorno não informado");
});

test("import rejects synthetic cards, unknown attributes and unitless weight", () => {
  const synthetic = parseHistoryPack({ origin: "synthetic", races: [] });
  assert.equal("errors" in synthetic, true);
  const unknown = parseHistoryPack({ origin: "user", entities: [], races: [], surpriseField: 1 });
  assert.equal("errors" in unknown && unknown.errors.some((issue) => issue.message.includes("não cadastrado")), true);
  const badWeight = parseHistoryPack({
    origin: "user",
    races: [{ key: "r", name: "M", offAt: "2026-06-01T15:00:00.000Z", runners: [{ horseKey: "h", weight: 70 }] }],
  });
  assert.equal("errors" in badWeight, true);
  const fact = parseHistoryPack({ origin: "user", facts: [{ subjectType: "horse", subjectKey: "h1", attr: "not-a-catalog-key", value: 1 }] });
  assert.equal("errors" in fact, true);
});

test("a repeated import does not merge homonyms or rewrite a result in place", async () => {
  const sql = await db();
  const first = await importHistory(sql, "user-a", pack, "batch-1");
  assert.equal(first.ok && first.replay, false);
  const again = await importHistory(sql, "user-a", pack, "batch-1");
  assert.equal(again.ok && again.replay, true);
  const horses = await listEntities(sql, "user-a", { kind: "horse", q: "Alpha" });
  assert.equal(horses.total, 2);
  const matches = await sql.query<{ n: number }>("select count(*)::int as n from h_matches where user_id = 'user-a'");
  assert.equal(Number(matches[0]?.n), 1);
  const other = await listEntities(sql, "user-b", { kind: "horse" });
  assert.equal(other.total, 0);
  const owned = await sql.query<{ id: string }>("select id from h_entities where user_id = 'user-a' and entity_key = 'h1'");
  const profile = await horseProfile(sql, "user-a", owned[0]!.id);
  assert.ok(profile);
  assert.equal(profile?.incidents[0]?.cause, "Causa não informada");
  assert.equal(profile?.episodes[0]?.returnLabel, "Retorno não informado");
  assert.equal(profile?.episodes[0]?.comeback.announced, false);
  assert.equal(profile?.partnerships.jockey[0]?.label, "Rui");
  assert.equal(profile?.partnerships.jockey[0]?.wins, 1);
  assert.equal(profile?.conditions.distance[0]?.label, "3200 m ou mais");
  assert.match(profile?.speed.note ?? "", /Sem parciais/);
  assert.notEqual(profile?.runs[0]?.carriedLb, profile?.runs[0]?.bodyKg);
  const sameBody = await importHistory(sql, "user-a", pack, "batch-other");
  assert.equal(sameBody.ok && sameBody.replay, true);
  const clash = await importHistory(sql, "user-a", { ...pack, entities: pack.entities.slice(0, 1) }, "batch-1");
  assert.equal(clash.ok, false);
  const corrected = structuredClone(pack);
  corrected.races[0]!.runners[0]!.position = 4;
  const second = await importHistory(sql, "user-a", corrected, "batch-2");
  assert.equal(second.ok && !second.replay, true);
  const revisions = await sql.query<{ patch: { position: number } | string }>("select patch from h_runner_revisions where user_id = 'user-a'");
  const patch = typeof revisions[0]?.patch === "string" ? JSON.parse(revisions[0].patch) : revisions[0]?.patch;
  assert.equal(patch.position, 1);
  const runners = await sql.query<{ n: number }>("select count(*)::int as n from h_runners where user_id = 'user-a'");
  assert.equal(Number(runners[0]?.n), 2);
  const events = await sql.query<{ n: number }>("select count(*)::int as n from h_episode_events where user_id = 'user-a'");
  assert.equal(Number(events[0]?.n), 1);
});

test("example rows do not train a promoted model", async () => {
  const sql = await db();
  const example = structuredClone(pack);
  example.origin = "example";
  await importHistory(sql, "user-a", example, "ex");
  const trained = await trainExperimental(sql, "user-a");
  assert.equal(trained.ok, false);
  assert.equal(trained.status, "experimental");
});

test("a real sample trains an experimental model without promoting it", async () => {
  const sql = await db();
  const races = Array.from({ length: 6 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return {
      key: `m${index}`,
      courseKey: "naas",
      name: `M${index}`,
      offAt: `2026-${month}-02T15:00:00.000Z`,
      runners: [
        { horseKey: "h1", jockeyKey: "j1", trainerKey: "t1", carriedLb: 150, started: true, position: index % 2 === 0 ? 1 : 2, prices: [{ book: "casa", market: "WIN", decimal: 4, kind: "preoff", observedAt: `2026-${month}-02T14:00:00.000Z` }] },
        { horseKey: "h3", jockeyKey: "j1", trainerKey: "t1", carriedLb: 151, started: true, position: index % 2 === 0 ? 2 : 1, prices: [{ book: "casa", market: "WIN", decimal: 3, kind: "preoff", observedAt: `2026-${month}-02T14:00:00.000Z` }] },
      ],
    };
  });
  const body = { origin: "user" as const, entities: pack.entities, courses: pack.courses, races };
  const imported = await importHistory(sql, "user-a", body, "train");
  assert.equal(imported.ok, true);
  const trained = await trainExperimental(sql, "user-a");
  assert.equal(trained.ok, true);
  if (trained.ok) {
    assert.equal(trained.status, "experimental");
    assert.equal(typeof trained.model.logloss, "number");
    assert.ok(trained.model.n > 0);
    assert.match(trained.model.brierScale, /0 e 1/);
    assert.equal(typeof trained.withoutMarket.logloss, "number");
    assert.equal(typeof trained.place.brier, "number");
    assert.equal(trained.reliability.length, 5);
    assert.equal(trained.status, "experimental");
  }
  const models = await sql.query<{ status: string }>("select status from h_models where user_id = 'user-a'");
  assert.equal(models[0]?.status, "experimental");
});

test("csv import keeps runners and rejects an unknown section", async () => {
  const csv = `# origin
value
user
# entities
kind,key,name,country,sex,foaledYear
horse,h9,Gamma,IE,,
# courses
key,name,country
naas,Naas,IE
# races
key,courseKey,name,country,discipline,offAt,distanceM,going,surface,raceClass,weatherForecast,weatherObserved,status
r9,naas,Maiden,IE,hurdle,2026-06-01T15:00:00.000Z,3200,Soft,,,,,declared
# runners
raceKey,horseKey,jockeyKey,trainerKey,cloth,draw,carriedLb,bodyKg,officialRating,providerRating,ownMetric,started,position,deadHeat,finishStatus,comment
r9,h9,,,,,154,480,,,,true,1,false,,
`;
  const parsed = parseHistoryCsv(csv);
  assert.equal("pack" in parsed, true);
  const sql = await db();
  if ("pack" in parsed) {
    const saved = await importHistory(sql, "user-a", parsed.pack, "auto");
    assert.equal(saved.ok && saved.replay, false);
    const again = await importHistory(sql, "user-a", parsed.pack, "auto");
    assert.equal(again.ok && again.replay, true);
    const horses = await listEntities(sql, "user-a", { kind: "horse", q: "Gamma" });
    assert.equal(horses.total, 1);
  }
  const unknown = parseHistoryCsv("# pedigree\nkey\nx\n");
  assert.equal("errors" in unknown && unknown.errors.some((issue) => issue.message.includes("não cadastrada")), true);
});
