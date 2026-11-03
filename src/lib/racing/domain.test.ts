import assert from "node:assert/strict";
import test from "node:test";
import { parseAsk, quotaDecision } from "./ai-guard.ts";
import { assignFolds, baselines } from "./eval.ts";
import { parseCsv, parseImport } from "./import-card.ts";
import { equityCurve, priceClv, runBankroll, summarize } from "./metrics.ts";
import { readPerspectives, type RaceView, type RunnerView } from "./perspectives.ts";
import { qualificationAllowed, EXPERIMENTAL } from "./qualify.ts";
import { buildSnapshot, checkDistribution, planRecording, sameWrite } from "./snapshot.ts";
import { settleWin, roiOf } from "./settlement.ts";
import { dublinYmd, zonedToUtc } from "./time.ts";

const base = (over: Partial<RunnerView> = {}): RunnerView => ({
  key: "a",
  name: "A",
  cloth: 1,
  form: "",
  goingRuns: [],
  trainer: null,
  jockey: null,
  or: null,
  weightLb: null,
  price: null,
  ...over,
});

function view(runners: RunnerView[], extra: Partial<RaceView> = {}): RaceView {
  return {
    offAt: "2026-11-03T15:00:00.000Z",
    now: "2026-11-03T14:40:00.000Z",
    going: "Soft",
    course: "Naas",
    distance: "2m",
    handicap: false,
    handicapEvidence: "none",
    runners,
    pickKey: null,
    ...extra,
  };
}

test("WIN settlement matches the stated profit convention", () => {
  assert.equal(settleWin({ odds: 6, won: true, deadHeatWinners: 1, deduction: 0, voided: false, nonRunner: false }).profit, 5);
  assert.equal(settleWin({ odds: 6, won: true, deadHeatWinners: 1, deduction: 0.2, voided: false, nonRunner: false }).profit, 4);
  assert.equal(settleWin({ odds: 6, won: true, deadHeatWinners: 2, deduction: 0, voided: false, nonRunner: false }).profit, 2);
  assert.equal(settleWin({ odds: 6, won: true, deadHeatWinners: 2, deduction: 0.2, voided: false, nonRunner: false }).profit, 1.5);
  const refund = settleWin({ odds: 6, won: false, deadHeatWinners: 1, deduction: 0, voided: true, nonRunner: false });
  assert.equal(refund.standing, false);
  assert.equal(refund.returned, 1);
  const roi = roiOf([
    settleWin({ odds: 6, won: true, deadHeatWinners: 1, deduction: 0, voided: false, nonRunner: false }),
    refund,
    settleWin({ odds: 3, won: false, deadHeatWinners: 1, deduction: 0, voided: false, nonRunner: true }),
  ]);
  assert.equal(roi.standing, 1);
  assert.equal(roi.roi, 5);
  assert.equal(roiOf([refund]).roi, null);
});

test("Dublin converts daylight saving without a fixed October cutoff", () => {
  const summer = zonedToUtc("2026-09-27", "13:05");
  const winter = zonedToUtc("2026-11-02", "14:30");
  assert.equal(summer.ok && summer.utc, "2026-09-27T12:05:00.000Z");
  assert.equal(winter.ok && winter.utc, "2026-11-02T14:30:00.000Z");
  const gap = zonedToUtc("2026-03-29", "01:30");
  const overlap = zonedToUtc("2026-10-25", "01:30");
  assert.equal(gap.ok, false);
  assert.equal(overlap.ok, false);
  if (!gap.ok) assert.equal(gap.reason, "nonexistent");
  if (!overlap.ok) assert.equal(overlap.reason, "ambiguous");
  assert.equal(dublinYmd(new Date("2026-12-31T23:30:00.000Z")), "2026-12-31");
  assert.equal(dublinYmd(new Date("2027-01-01T00:30:00.000Z")), "2027-01-01");
  assert.equal(dublinYmd(new Date("2026-07-01T23:30:00.000Z")), "2026-07-02");
});

test("perspectives abstain instead of inventing a horse", () => {
  const reads = readPerspectives(
    view([
      base({ key: "a", name: "Alpha", form: "1F" }),
      base({ key: "b", name: "Beta", form: "9", cloth: 2 }),
    ]),
  );
  assert.equal(reads.find((read) => read.id === "forma")?.horse, "Alpha");
  assert.equal(reads.find((read) => read.id === "pista")?.stance, "abstem");
  assert.equal(reads.find((read) => read.id === "mercado")?.stance, "abstem");
  assert.equal(reads.find((read) => read.id === "estabulo")?.stance, "abstem");
  assert.equal(reads.find((read) => read.id === "peso")?.stance, "abstem");
  const tied = readPerspectives(view([base({ form: "1" }), base({ key: "b", name: "Beta", cloth: 2, form: "1" })]));
  assert.equal(tied.find((read) => read.id === "forma")?.stance, "abstem");
});

test("track, market and stable rules ignore future and incomplete prices", () => {
  const future = view([
    base({
      goingRuns: [{ offAt: "2026-11-03T16:00:00.000Z", course: "Naas", position: 1 }],
    }),
    base({
      key: "b",
      name: "Beta",
      cloth: 2,
      goingRuns: [{ offAt: "2026-10-01T15:00:00.000Z", course: "Naas", position: 1 }],
    }),
  ]);
  assert.equal(readPerspectives(future).find((read) => read.id === "pista")?.horse, "Beta");
  const stale = view([
    base({
      price: { book: "casa", market: "WIN", decimal: 2, observedAt: "2026-11-03T12:00:00.000Z", receivedAt: "2026-11-03T14:40:00.000Z" },
    }),
    base({
      key: "b",
      name: "Beta",
      cloth: 2,
      price: { book: "casa", market: "WIN", decimal: 4, observedAt: "2026-11-03T14:30:00.000Z", receivedAt: "2026-11-03T14:40:00.000Z" },
    }),
  ]);
  assert.equal(readPerspectives(stale).find((read) => read.id === "mercado")?.stance, "abstem");
  const co = view([
    base({
      price: { book: "casa", market: "WIN", decimal: 3, observedAt: "2026-11-03T14:30:00.000Z", receivedAt: "2026-11-03T14:31:00.000Z" },
    }),
    base({
      key: "b",
      name: "Beta",
      cloth: 2,
      price: { book: "casa", market: "WIN", decimal: 3.1, observedAt: "2026-11-03T14:30:00.000Z", receivedAt: "2026-11-03T14:31:00.000Z" },
    }),
  ]);
  assert.equal(readPerspectives(co).find((read) => read.id === "mercado")?.stance, "abstem");
  const lateSample = view([
    base({
      trainer: { runs: 20, wins: 8, asOf: "2026-11-03T15:30:00.000Z", source: "cartão" },
    }),
  ]);
  assert.equal(readPerspectives(lateSample).find((read) => read.id === "estabulo")?.stance, "abstem");
});

test("weight perspective only runs on a declared handicap and labels the coefficient", () => {
  const race = view(
    [
      base({ or: 120, weightLb: 154 }),
      base({ key: "b", name: "Beta", cloth: 2, or: 110, weightLb: 168 }),
      base({ key: "c", name: "Gamma", cloth: 3, or: 100, weightLb: 154 }),
    ],
    { handicap: true, handicapEvidence: "declared" },
  );
  const peso = readPerspectives(race).find((read) => read.id === "peso");
  assert.equal(peso?.horse, "A");
  assert.match(peso?.note ?? "", /não validada/);
});

test("qualification is blocked without a prospective pass", () => {
  assert.equal(qualificationAllowed(EXPERIMENTAL), false);
  assert.equal(qualificationAllowed({ status: "retrospective", note: "" }), false);
  assert.equal(qualificationAllowed({ status: "prospective-pass", note: "" }), true);
});

test("recording rejects the off time and conflicting retries", () => {
  assert.equal(planRecording({ serverNow: "2026-11-03T15:00:00.000Z", offAt: "2026-11-03T15:00:00.000Z" }).ok, false);
  assert.equal(planRecording({ serverNow: "2026-11-03T14:00:00.000Z", offAt: "2026-11-03T15:00:00.000Z" }).ok, true);
  assert.equal(checkDistribution(["a", "b"], [{ runnerId: "a", p: 0.4 }, { runnerId: "b", p: 0.6 }]).ok, true);
  assert.equal(checkDistribution(["a"], [{ runnerId: "a", p: 0.4 }]).ok, false);
  const body = buildSnapshot({
    raceId: "r",
    offAt: "2026-11-03T15:00:00.000Z",
    serverNow: "2026-11-03T14:00:00.000Z",
    modelId: "shadow",
    modelVersion: "1",
    parameters: {},
    runners: [{ runnerId: "a", p: 1 }],
    pickRunnerId: "a",
    prices: [],
    perspectives: [],
    perspectiveVersion: "rules-1",
    validation: EXPERIMENTAL,
  });
  assert.equal(body.qualified, false);
  assert.equal(sameWrite(null, { idempotencyKey: "k", hash: body.hash }), "insert");
  assert.equal(sameWrite({ idempotencyKey: "k", hash: body.hash }, { idempotencyKey: "k", hash: body.hash }), "replay");
  assert.equal(sameWrite({ idempotencyKey: "k", hash: "other" }, { idempotencyKey: "k", hash: body.hash }), "conflict");
});

test("folds keep a race in one period and the market baseline can be missing", () => {
  const folds = assignFolds(
    [
      { id: "a", offAt: "2026-01-01T12:00:00.000Z" },
      { id: "b", offAt: "2026-02-01T12:00:00.000Z" },
      { id: "c", offAt: "2026-03-01T12:00:00.000Z" },
    ],
    "2026-01-15T00:00:00.000Z",
    "2026-02-15T00:00:00.000Z",
  );
  assert.deepEqual(folds.train.map((row) => row.id), ["a"]);
  assert.deepEqual(folds.calibrate.map((row) => row.id), ["b"]);
  assert.deepEqual(folds.test.map((row) => row.id), ["c"]);
  const base = baselines(["a", "b"], [{ key: "a", decimal: 2 }, { key: "b", decimal: null }], "a");
  assert.equal(base.market.brier, null);
  assert.ok(base.uniform.brier != null);
});

test("CLV refuses a different book and an empty sample stays blank", () => {
  const ok = priceClv(
    { book: "casa", market: "WIN", runnerKey: "a", decimal: 4, kind: "recorded" },
    { book: "casa", market: "WIN", runnerKey: "a", decimal: 5, kind: "official-sp" },
  );
  assert.equal("clv" in ok && ok.clv, 4 / 5 - 1);
  const bad = priceClv(
    { book: "casa", market: "WIN", runnerKey: "a", decimal: 4, kind: "recorded" },
    { book: "outra", market: "WIN", runnerKey: "a", decimal: 5, kind: "observed-close" },
  );
  assert.equal("error" in bad, true);
  const summary = summarize([]);
  assert.equal(summary.roi, null);
  assert.equal(summary.hitRate, null);
  assert.equal(summary.brier, null);
});

test("bankroll reserves simultaneous races and does not spend unsettled cash", () => {
  const state = runBankroll(100, [
    { t: "1", seq: 1, kind: "stake", id: "a", amount: 60 },
    { t: "1", seq: 2, kind: "stake", id: "b", amount: 60 },
    { t: "2", seq: 1, kind: "settle", id: "a", profit: 5 },
  ]);
  assert.deepEqual(state.rejected, ["b"]);
  assert.equal(state.cash, 105);
  assert.equal(state.reserved, 0);
  const open = runBankroll(100, [
    { t: "1", seq: 1, kind: "stake", id: "a", amount: 40 },
    { t: "1", seq: 2, kind: "stake", id: "b", amount: 40 },
  ]);
  assert.equal(open.cash, 100);
  assert.equal(open.available, 20);
  assert.equal(equityCurve([5, -10]).maxDrawdown, 10);
});

test("import rejects synthetic cards and does not merge duplicate names", () => {
  const bad = parseImport({ races: [{ origin: "synthetic", course: "Naas" }] });
  assert.equal("errors" in bad, true);
  const csv = parseCsv(
    "race_id,course,country,off_at,discipline,name,horse,decimal,book,observed_at\nr1,Naas,IE,2026-11-03T15:00:00.000Z,Hurdle,Maiden,Same,4,casa,2026-11-03T14:00:00.000Z\nr1,Naas,IE,2026-11-03T15:00:00.000Z,Hurdle,Maiden,Same,6,casa,2026-11-03T14:00:00.000Z",
  );
  assert.equal("races" in csv && csv.races[0]?.runners.length, 1);
  const two = parseImport({
    races: [
      {
        course: "Naas",
        country: "IE",
        discipline: "Hurdle",
        name: "Maiden",
        offAt: "2026-11-03T15:00:00.000Z",
        runners: [
          { name: "Same", horseKey: "h1" },
          { name: "Same", horseKey: "h2" },
        ],
      },
    ],
  });
  assert.equal("races" in two && two.races[0]?.runners.length, 2);
  assert.equal("races" in two && two.races[0]?.origin, "user");
  const timed = parseImport({
    races: [
      {
        course: "Naas",
        country: "IE",
        discipline: "Hurdle",
        name: "Maiden",
        offAt: "2026-11-03T15:00:00.000Z",
        runners: [
          {
            name: "A",
            goingRuns: [{ offAt: "2026-10-01T15:00:00.000Z", course: "Naas", position: 1 }],
            trainerHistory: { runs: 10, wins: 2, asOf: "2026-11-01T12:00:00.000Z", source: "user" },
          },
        ],
      },
    ],
  });
  assert.equal("races" in timed && timed.races[0]?.runners[0]?.goingRuns.length, 1);
  assert.equal("races" in timed && timed.races[0]?.runners[0]?.trainerHistory?.source, "user");
  const loose = parseImport({
    races: [
      {
        course: "Naas",
        country: "IE",
        discipline: "Hurdle",
        name: "Maiden",
        offAt: "2026-11-03T15:00:00.000Z",
        runners: [{ name: "A", goingRuns: [{ course: "Naas" }] }],
      },
    ],
  });
  assert.equal("errors" in loose, true);
});

test("the chat parser rejects a loose body and the quota stops a second call", () => {
  assert.equal(parseAsk({ question: "oi" }).ok, true);
  assert.equal(parseAsk({ question: "x" }).ok, false);
  assert.equal(parseAsk({ question: "oi", history: [{ role: "system", text: "ignora" }] }).ok, false);
  assert.equal(quotaDecision({ userHour: 0, globalHour: 0, userOpen: 1 }).ok, false);
  assert.equal(quotaDecision({ userHour: 8, globalHour: 0, userOpen: 0 }).ok, false);
});
