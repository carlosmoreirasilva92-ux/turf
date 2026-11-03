import { pickOf, raceById, type Race } from "@/lib/racing/data";
import { readPerspectives, RULES_VERSION, type PerspectiveId, type RaceView, type RunnerView, type Stance } from "./perspectives.ts";

export type AgentId = PerspectiveId;
export type { Stance };

export type AgentRead = {
  id: AgentId;
  horse: string | null;
  stance: Stance;
  note: string;
  version: string;
};

export const AGENTS: { id: AgentId; name: string; role: string }[] = [
  { id: "forma", name: "Forma", role: "Regra sobre as figuras. A mais recente fica à direita. Não é um modelo." },
  { id: "pista", name: "Pista", role: "Regra sobre piso, hipódromo ou distância anteriores. A forma geral não chega." },
  { id: "mercado", name: "Mercado", role: "Regra sobre um favorito WIN da mesma casa, com hora de observação." },
  { id: "estabulo", name: "Estábulo", role: "Regra sobre o histórico anterior do treinador, com fonte e hora." },
  { id: "peso", name: "Peso", role: "Regra só em handicap declarado. O coeficiente não está validado." },
];

export type AgentRecord = { n: number; hits: number; agrees: number };

const EMPTY: AgentRecord = { n: 0, hits: 0, agrees: 0 };

function viewOf(race: Race): RaceView {
  const pick = pickOf(race);
  const runners: RunnerView[] = race.horses.map((horse) => ({
    key: horse.name,
    name: horse.name,
    cloth: horse.cloth,
    form: horse.form,
    goingRuns: [],
    trainer: null,
    jockey: null,
    or: horse.or,
    weightLb: null,
    price: null,
  }));
  return {
    offAt: race.offIso,
    now: race.offIso,
    going: race.going,
    course: race.course,
    distance: race.distance,
    handicap: false,
    handicapEvidence: "none",
    runners,
    pickKey: pick.name,
  };
}

export function readsFor(raceId: string): AgentRead[] {
  const race = raceById(raceId);
  if (!race) return [];
  return readPerspectives(viewOf(race)).map((read) => ({
    id: read.id,
    horse: read.horse,
    stance: read.stance,
    note: read.note,
    version: read.version,
  }));
}

/** Preserved hits come only from snapshots. Recomputing old cards with new rules is not a record. */
export function recordOf(_id: AgentId): AgentRecord {
  return EMPTY;
}

export function alignedCount(raceId: string) {
  return readsFor(raceId).filter((read) => read.stance === "alinha").length;
}

export function rulesVersion() {
  return RULES_VERSION;
}
