import type { LiveBoard } from "./live-source.ts";
import type { LiveRace } from "./live-card.ts";

export type SourceRow = {
  id: string;
  name: string;
  aliases: string[];
  active: boolean;
  needsAccount: boolean;
  decision: string;
};

/** The agent may read this. It must not log into a bookmaker from this app. */
export function sourceDecision(): { active: string; sources: SourceRow[] } {
  return {
    active: "cartao-publico",
    sources: [
      {
        id: "cartao-publico",
        name: "Cartão público",
        aliases: [],
        active: true,
        needsAccount: false,
        decision: "Fonte em uso. É a única que responde sem conta. Não é uma casa e não é o SP.",
      },
      {
        id: "conta-casa",
        name: "Conta de casa",
        aliases: ["Paddy Power", "TED Power"],
        active: false,
        needsAccount: true,
        decision:
          "Não ligada. Este servidor não entra na conta, não pede palavra-passe e não a guarda. O agente pode consultar a casa à parte. Esses preços só entram na mesa por importação, marcados como informados pelo utilizador.",
      },
      {
        id: "the-racing-api",
        name: "The Racing API",
        aliases: [],
        active: false,
        needsAccount: true,
        decision: "Não ligada. Precisa de conta própria. Sem chave, não há pedido.",
      },
      {
        id: "demonstracao",
        name: "Caderno de demonstração",
        aliases: [],
        active: false,
        needsAccount: false,
        decision: "Não é fonte de decisão. Cavalos e resultados são exemplo.",
      },
    ],
  };
}

export const AGENT_RULES = [
  "A percentagem é 1 a dividir pelo preço publicado. Não é um modelo treinado.",
  "O preço mais curto é o favorito desse cartão, não uma seleção qualificada.",
  "Se o cavalo vencer, o retorno é aposta vezes o decimal. Se não vencer, perde-se a aposta.",
  "Não inventar odd, resultado, jóquei, lesão ou prazo de regresso.",
  "Não usar o caderno de demonstração para escolher um cavalo real.",
  "Não tratar uma conta de casa como fonte ativa enquanto ela não estiver importada e marcada.",
];

export function bestOfDay(board: LiveBoard, stake = 10) {
  const open = board.races.filter((race) => race.stage === "DORMANT" || race.stage === "OFF");
  return open
    .filter((race) => race.shownName && race.shownDecimal != null && race.shownDecimal > 1)
    .sort((a, b) => (a.shownDecimal ?? 99) - (b.shownDecimal ?? 99) || (a.time ?? "").localeCompare(b.time ?? ""))
    .slice(0, 5)
    .map((race, index) => {
      const decimal = race.shownDecimal as number;
      return {
        rank: index + 1,
        raceId: race.id,
        course: race.course,
        country: race.country,
        time: race.time,
        name: race.name,
        horse: race.shownName,
        jockey: race.shownJockey,
        trainer: race.shownTrainer,
        fractional: race.shownFractional,
        decimal,
        percent: Number((100 / decimal).toFixed(1)),
        stake,
        returnIfWins: Number((stake * decimal).toFixed(2)),
        profitIfWins: Number((stake * (decimal - 1)).toFixed(2)),
        lossIfLoses: stake,
      };
    });
}

export function raceForAgent(race: LiveRace, stake = 10) {
  const runners = race.runners
    .slice()
    .sort((a, b) => (a.decimal ?? 999) - (b.decimal ?? 999) || (a.cloth ?? 99) - (b.cloth ?? 99))
    .map((runner) => ({
      id: runner.id,
      cloth: runner.cloth,
      name: runner.name,
      jockey: runner.jockey,
      trainer: runner.trainer,
      form: runner.form,
      officialRating: runner.or,
      weightLb: runner.weightLb,
      status: runner.status,
      fractional: runner.fractional,
      decimal: runner.decimal,
      percent: runner.decimal != null && runner.decimal > 1 ? Number((100 / runner.decimal).toFixed(1)) : null,
      returnIfWins: runner.decimal != null ? Number((stake * runner.decimal).toFixed(2)) : null,
      profitIfWins: runner.decimal != null ? Number((stake * (runner.decimal - 1)).toFixed(2)) : null,
    }));
  return {
    id: race.id,
    course: race.course,
    country: race.country,
    name: race.name,
    date: race.date,
    time: race.time,
    distance: race.distance,
    going: race.going,
    discipline: race.discipline,
    stage: race.stage,
    receivedAt: race.receivedAt,
    source: "cartão público",
    stake,
    runners,
  };
}
