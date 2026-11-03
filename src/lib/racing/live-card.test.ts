import assert from "node:assert/strict";
import test from "node:test";
import { fractionalToDecimal, parseLiveDay, parseLiveRace, shortestShown, stonesToLb } from "./live-card.ts";

test("public prices convert only when the fraction is present", () => {
  assert.equal(fractionalToDecimal("5/6"), 1.833);
  assert.equal(fractionalToDecimal("1/1"), 2);
  assert.equal(fractionalToDecimal("Evs"), 2);
  assert.equal(fractionalToDecimal("SP"), null);
  assert.equal(fractionalToDecimal(""), null);
  assert.equal(stonesToLb("11-5"), 159);
  assert.equal(stonesToLb("11-14"), null);
});

test("a public card keeps missing fields empty and drops the tip", () => {
  const parsed = parseLiveDay(
    [
      {
        meeting_summary: {
          meeting_reference: { id: 1 },
          status: "DORMANT",
          going: "Good",
          course: { name: "Fairyhouse", country: { long_name: "Eire" } },
        },
        races: [
          {
            race_summary_reference: { id: 99 },
            name: "Beginners' Chase",
            course_name: "Fairyhouse",
            country_short_name: "IRE",
            date: "2026-11-03",
            time: "12:18",
            distance: "2m",
            has_handicap: false,
            race_stage: "DORMANT",
            ride_count: 8,
            verdict_text: "não pode aparecer",
          },
        ],
      },
    ],
    "2026-11-03T08:00:00.000Z",
    "2026-11-03",
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const race = parsed.day.meetings[0]?.races[0];
  assert.equal(race?.country, "IE");
  assert.equal(race?.discipline, "Chase");
  assert.equal(race?.offAt, "2026-11-03T12:18:00.000Z");
  assert.equal(JSON.stringify(parsed.day).includes("não pode aparecer"), false);
  const broken = parseLiveDay({ origin: "synthetic" }, "2026-11-03T08:00:00.000Z", "2026-11-03");
  assert.equal(broken.ok, false);
});

test("a race fiche ignores a price that is not a fraction and future runs", () => {
  const parsed = parseLiveRace(
    {
      race_summary: {
        race_summary_reference: { id: 99 },
        name: "Maiden Hurdle",
        course_name: "Naas",
        country_short_name: "IRE",
        date: "2026-11-03",
        time: "15:00",
        race_stage: "DORMANT",
        has_handicap: true,
        verdict: "segredo",
      },
      rides: [
        {
          ride_reference: { id: 7 },
          cloth_number: 1,
          finish_position: 0,
          ride_status: "RUNNER",
          handicap: "11-5",
          official_rating: 120,
          betting: { current_odds: "SP" },
          horse: {
            name: "Alpha",
            age: 6,
            horse_reference: { id: 44 },
            formsummary: { display_text: "21" },
            previous_results: [
              { date: "2026-11-04", time: "15:00", course_name: "Naas", going: "Soft", position: 1 },
              { date: "2026-10-01", time: "14:00", course_name: "Naas", going: "Good", position: 2 },
            ],
          },
          jockey: { name: "Rachael" },
          trainer: { name: "W P" },
        },
      ],
    },
    "2026-11-03T10:00:00.000Z",
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const runner = parsed.race.runners[0];
  assert.equal(runner?.decimal, null);
  assert.equal(runner?.weightLb, 159);
  assert.equal(runner?.goingRuns.length, 1);
  assert.equal(runner?.age, 6);
  assert.equal(runner?.horseId, "44");
  assert.equal(runner?.position, null);
  assert.equal(JSON.stringify(parsed.race).includes("segredo"), false);
});

test("the shortest shown price is the published price, not a missing one", () => {
  const pick = shortestShown([
    { id: "a", name: "A", cloth: 1, jockey: null, trainer: null, form: null, or: null, weightLb: null, status: "RUNNER", position: null, fractional: "10/1", decimal: 11, goingRuns: [] },
    { id: "b", name: "B", cloth: 2, jockey: null, trainer: null, form: null, or: null, weightLb: null, status: "RUNNER", position: null, fractional: "SP", decimal: null, goingRuns: [] },
    { id: "c", name: "C", cloth: 3, jockey: null, trainer: null, form: null, or: null, weightLb: null, status: "NON_RUNNER", position: null, fractional: "1/2", decimal: 1.5, goingRuns: [] },
    { id: "d", name: "D", cloth: 4, jockey: null, trainer: null, form: null, or: null, weightLb: null, status: "RUNNER", position: null, fractional: "7/2", decimal: 4.5, goingRuns: [] },
  ]);
  assert.equal(pick?.name, "D");
});
