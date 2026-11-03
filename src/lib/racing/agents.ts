import { pickOf, races, type Race } from "@/lib/racing/data";

export type AgentId = "forma" | "pista" | "mercado" | "estabulo" | "peso";

export type Stance = "alinha" | "discorda" | "abstem";

export type AgentRead = {
  id: AgentId;
  horse: string | null;
  stance: Stance;
  note: string;
};

export const AGENTS: { id: AgentId; name: string; role: string }[] = [
  { id: "forma", name: "Forma", role: "Últimas saídas, a mais recente pesa mais" },
  { id: "pista", name: "Pista", role: "Piso, experiência e peso no terreno" },
  { id: "mercado", name: "Mercado", role: "Favorito da cotação real travada" },
  { id: "estabulo", name: "Estábulo", role: "Jóquei e treinador, só com amostra anterior" },
  { id: "peso", name: "Peso", role: "Balanço rating/peso, só em handicaps" },
];

export type AgentRecord = { n: number; hits: number; agrees: number };

function pounds(weight: string) {
  const [st, lb] = weight.split("-").map(Number);
  return (st || 0) * 14 + (lb || 0);
}

function formFigures(form: string) {
  if (!form || form === "—") return [];
  return form.replace(/-/g, "").split("");
}

function formScore(form: string) {
  const figs = formFigures(form);
  if (figs.length === 0) return null;
  let score = 0;
  let weight = 1;
  for (let i = figs.length - 1; i >= 0; i--) {
    const place = figs[i]! >= "1" && figs[i]! <= "9" ? Number(figs[i]) : 12;
    const pts = place === 1 ? 8 : place === 2 ? 5 : place === 3 ? 3 : place <= 5 ? 1 : 0;
    score += pts * weight;
    weight *= 0.55;
  }
  return score;
}

function best<T>(rows: T[], score: (row: T) => number | null, tie: (row: T) => number): T | null {
  let winner: T | null = null;
  let bestScore = -Infinity;
  let bestTie = Infinity;
  for (const row of rows) {
    const s = score(row);
    if (s == null) continue;
    const t = tie(row);
    if (s > bestScore + 1e-9 || (Math.abs(s - bestScore) <= 1e-9 && t < bestTie)) {
      winner = row;
      bestScore = s;
      bestTie = t;
    }
  }
  return winner;
}

function stanceOf(race: Race, horse: string | null): Stance {
  if (!horse) return "abstem";
  return horse === race.pickName ? "alinha" : "discorda";
}

function readForma(race: Race): AgentRead {
  const horse = best(race.horses, (h) => formScore(h.form), (h) => h.cloth);
  if (!horse) {
    return {
      id: "forma",
      horse: null,
      stance: "abstem",
      note: "Nenhum cavalo tem figuras. Sem amostra, não nomeia.",
    };
  }
  return {
    id: "forma",
    horse: horse.name,
    stance: stanceOf(race, horse.name),
    note: `Figuras ${horse.form}. A saída mais recente pesa mais do que o resto do campo.`,
  };
}

function readPista(race: Race): AgentRead {
  const heavy = /Pesado|Macio|Lento/.test(race.going);
  const fast = /Standard|Bom/.test(race.going) && !/Macio|Lento/.test(race.going);
  const horse = best(
    race.horses,
    (h) => {
      const figs = formFigures(h.form);
      if (figs.length === 0) return heavy ? -2 : null;
      const recent = figs[figs.length - 1]!;
      const placed = recent === "1" ? 6 : recent === "2" ? 4 : recent === "3" ? 2 : 0;
      const experience = Math.min(figs.length, 5) * (heavy ? 1.4 : 0.4);
      const weight = pounds(h.weight) * (heavy ? 0.04 : fast ? 0.01 : 0.02);
      return placed + experience - weight;
    },
    (h) => h.cloth,
  );
  if (!horse) {
    return {
      id: "pista",
      horse: null,
      stance: "abstem",
      note: `Piso ${race.going}, mas o campo não tem figuras para comparar.`,
    };
  }
  const bias = heavy
    ? "Em piso pesado conta experiência e menos peso."
    : fast
      ? "Em piso rápido a última vitória ou lugar pesa mais."
      : "Piso intermédio: figura recente e peso equilibrados.";
  return {
    id: "pista",
    horse: horse.name,
    stance: stanceOf(race, horse.name),
    note: `${race.going}. ${bias}`,
  };
}

function readMercado(race: Race): AgentRead {
  const priced = race.horses.filter((h) => h.odds != null);
  if (priced.length < 4) {
    return {
      id: "mercado",
      horse: null,
      stance: "abstem",
      note: "Cotação real em falta na maior parte do campo. Não inventa favorito.",
    };
  }
  const horse = best(priced, (h) => (h.odds == null ? null : -h.odds), (h) => h.cloth);
  if (!horse || horse.odds == null) {
    return {
      id: "mercado",
      horse: null,
      stance: "abstem",
      note: "Sem decimal travado para nomear.",
    };
  }
  return {
    id: "mercado",
    horse: horse.name,
    stance: stanceOf(race, horse.name),
    note: `Favorito da cotação travada, a ${horse.odds.toFixed(2)}.`,
  };
}

type Tally = { runs: number; wins: number };

function rate(map: Map<string, Tally>, key: string, min: number) {
  const row = map.get(key);
  if (!row || row.runs < min) return null;
  return row;
}

function readEstabulo(race: Race, trainers: Map<string, Tally>, jockeys: Map<string, Tally>): AgentRead {
  const horse = best(
    race.horses,
    (h) => {
      const trainer = rate(trainers, h.trainer, 4);
      if (!trainer) return null;
      const jockey = rate(jockeys, h.jockey, 3);
      const tr = trainer.wins / trainer.runs;
      const jk = jockey ? jockey.wins / jockey.runs : tr;
      return tr * 0.7 + jk * 0.3;
    },
    (h) => h.cloth,
  );
  if (!horse) {
    return {
      id: "estabulo",
      horse: null,
      stance: "abstem",
      note: "Treinadores ainda sem 4 corridas liquidadas antes desta. Amostra curta.",
    };
  }
  const trainer = trainers.get(horse.trainer)!;
  return {
    id: "estabulo",
    horse: horse.name,
    stance: stanceOf(race, horse.name),
    note: `${horse.trainer} leva ${trainer.wins} em ${trainer.runs} antes desta partida. ${horse.jockey} no selim.`,
  };
}

function readPeso(race: Race): AgentRead {
  const handicap = race.grade.includes("Handicap") || race.grade.includes("Rated");
  if (!handicap) {
    return {
      id: "peso",
      horse: null,
      stance: "abstem",
      note: "Não é handicap. O peso não chega para separar o campo.",
    };
  }
  const rated = race.horses.filter((h) => h.or != null);
  if (rated.length < 3) {
    return {
      id: "peso",
      horse: null,
      stance: "abstem",
      note: "Handicap sem ratings suficientes no cartão.",
    };
  }
  const horse = best(rated, (h) => (h.or ?? 0) - pounds(h.weight) * 0.45, (h) => h.cloth);
  if (!horse) {
    return { id: "peso", horse: null, stance: "abstem", note: "Sem rating para comparar." };
  }
  return {
    id: "peso",
    horse: horse.name,
    stance: stanceOf(race, horse.name),
    note: `OR ${horse.or} com ${horse.weight}. Melhor balanço rating contra o peso do campo.`,
  };
}

function bump(map: Map<string, Tally>, key: string, won: boolean) {
  const row = map.get(key) ?? { runs: 0, wins: 0 };
  row.runs += 1;
  if (won) row.wins += 1;
  map.set(key, row);
}

function buildDesk() {
  const trainers = new Map<string, Tally>();
  const jockeys = new Map<string, Tally>();
  const byRace = new Map<string, AgentRead[]>();
  const records = Object.fromEntries(AGENTS.map((a) => [a.id, { n: 0, hits: 0, agrees: 0 }])) as Record<
    AgentId,
    AgentRecord
  >;

  for (const race of races) {
    const reads = [
      readForma(race),
      readPista(race),
      readMercado(race),
      readEstabulo(race, trainers, jockeys),
      readPeso(race),
    ];
    byRace.set(race.id, reads);
    if (race.status === "settled") {
      for (const read of reads) {
        if (!read.horse) continue;
        const rec = records[read.id];
        rec.n += 1;
        const named = race.horses.find((h) => h.name === read.horse);
        if (named?.position === 1) rec.hits += 1;
        if (read.horse === race.pickName) rec.agrees += 1;
      }
      for (const horse of race.horses) {
        bump(trainers, horse.trainer, horse.position === 1);
        bump(jockeys, horse.jockey, horse.position === 1);
      }
    }
  }

  return { byRace, records };
}

const desk = buildDesk();

export function readsFor(raceId: string): AgentRead[] {
  return desk.byRace.get(raceId) ?? [];
}

export function recordOf(id: AgentId): AgentRecord {
  return desk.records[id];
}

export function alignedCount(raceId: string) {
  return readsFor(raceId).filter((r) => r.stance === "alinha").length;
}

export function modelLine(race: Race) {
  const pick = pickOf(race);
  return `${pick.name} · leitura do modelo`;
}
