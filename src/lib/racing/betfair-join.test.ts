import assert from "node:assert/strict";
import test from "node:test";
import { horseKey, isValor, joinExchange, type CardRace, type ExchangeMarket } from "./betfair-join.ts";

const race: CardRace = {
  id: "10",
  course: "Kempton Park",
  time: "15:30",
  offAt: "2026-11-03T15:30:00.000Z",
  runners: [
    { name: "Oakfield Dream (IRE)", cloth: 1, decimal: 4.4, fractional: "7/2", status: "RUNNER" },
    { name: "Copper Lane", cloth: 2, decimal: 3.2, fractional: "11/5", status: "RUNNER" },
    { name: "Out", cloth: 3, decimal: 8, fractional: "7/1", status: "NON_RUNNER" },
  ],
};

const markets: ExchangeMarket[] = [
  {
    venue: "Kempton",
    start: "2026-11-03T15:31:00.000Z",
    runners: [
      { name: "Oakfield Dream", cloth: 1, back: 3.5, status: "ACTIVE" },
      { name: "Copper Lane", cloth: 2, back: 3.1, status: "ACTIVE" },
    ],
  },
  {
    venue: "Ascot",
    start: "2026-11-03T15:30:00.000Z",
    runners: [{ name: "Oakfield Dream", cloth: 1, back: 2, status: "ACTIVE" }],
  },
];

test("o nome ignora país e pontuação", () => {
  assert.equal(horseKey("Oakfield Dream (IRE)"), "oakfield dream");
});

test("valor começa quando o cartão é 10% maior do que o back", () => {
  assert.equal(isValor(3.3, 3), true);
  assert.equal(isValor(3.29, 3), false);
});

test("junta o back certo e ordena as oportunidades pela diferença", () => {
  const joined = joinExchange([race], markets);
  const oak = joined.quotes["10"]?.["oakfield dream"];
  assert.equal(oak?.back, 3.5);
  assert.equal(oak?.valor, true);
  assert.equal(joined.quotes["10"]?.["copper lane"]?.valor, false);
  assert.equal(joined.opportunities.map((row) => row.horse).join(","), "Oakfield Dream (IRE)");
  assert.equal(joined.opportunities[0]?.percent, 28.6);
});
