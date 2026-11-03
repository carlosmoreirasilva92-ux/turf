import assert from "node:assert/strict";
import test from "node:test";
import { AGENT_RULES, bestOfDay, sourceDecision } from "./agent-contract.ts";
import type { LiveBoard } from "./live-source.ts";

test("a fonte ativa é o cartão público e a conta de casa fica de fora", () => {
  const decision = sourceDecision();
  assert.equal(decision.active, "cartao-publico");
  const house = decision.sources.find((source) => source.id === "betfair-exchange");
  assert.equal(house?.name, "Betfair Exchange");
  assert.equal(house?.active, false);
  assert.equal(house?.aliases.includes("Paddy Power"), true);
  assert.match(AGENT_RULES.join(" "), /palavra-passe/);
  assert.match(house?.decision ?? "", /não é aberta/i);
});

test("os melhores do dia são os preços mais curtos ainda por largar", () => {
  const board: LiveBoard = {
    date: "2026-11-03",
    receivedAt: "2026-11-03T10:00:00.000Z",
    races: [
      { id: "1", course: "A", country: "IE", name: "A", time: "13:00", date: "2026-11-03", offAt: null, distance: null, going: null, handicap: false, discipline: null, stage: "DORMANT", runnersDeclared: 8, shownName: "Longo", shownJockey: null, shownTrainer: null, shownFractional: "10/1", shownDecimal: 11, shownForm: null, field: 8 },
      { id: "2", course: "B", country: "IE", name: "B", time: "12:00", date: "2026-11-03", offAt: null, distance: null, going: null, handicap: false, discipline: null, stage: "OFF", runnersDeclared: 8, shownName: "Curto", shownJockey: "J", shownTrainer: "T", shownFractional: "5/4", shownDecimal: 2.25, shownForm: "1", field: 8 },
      { id: "3", course: "C", country: "IE", name: "C", time: "11:00", date: "2026-11-03", offAt: null, distance: null, going: null, handicap: false, discipline: null, stage: "RESULT", runnersDeclared: 8, shownName: "Ja correu", shownJockey: null, shownTrainer: null, shownFractional: "1/2", shownDecimal: 1.5, shownForm: null, field: 8 },
    ],
  };
  const best = bestOfDay(board, 10);
  assert.equal(best[0]?.horse, "Curto");
  assert.equal(best[0]?.percent, 44.4);
  assert.equal(best[0]?.returnIfWins, 22.5);
  assert.equal(best[0]?.profitIfWins, 12.5);
  assert.equal(best.some((row) => row.horse === "Ja correu"), false);
});
