import {
  DESK_MS,
  DESK_YMD,
  addDays,
  addMinutes,
  daysBetween,
  fmtShort,
  offIso,
  weekday,
} from "./format.ts";

export type Discipline = "Hurdle" | "Chase" | "Flat" | "Bumper";
export type Pattern = "solid" | "hoops" | "sash" | "stars" | "check";
export type RaceStatus = "upcoming" | "off" | "awaiting" | "settled";

export type Silk = { a: string; b: string; pattern: Pattern };

export type Horse = {
  name: string;
  cloth: number;
  jockey: string;
  trainer: string;
  age: number;
  weight: string;
  or: number | null;
  form: string;
  silk: Silk;
  modelP: number;
  odds: number | null;
  sp: number | null;
  position: number | null;
};

export type Gate = {
  code: string;
  title: string;
  why: string;
  passed: boolean;
};

export type Race = {
  id: string;
  course: string;
  country: "IE" | "GB";
  date: string;
  time: string;
  offIso: string;
  name: string;
  discipline: Discipline;
  distance: string;
  going: string;
  grade: string;
  prize: string;
  horses: Horse[];
  status: RaceStatus;
  pickName: string;
  qualified: boolean;
  gates: Gate[];
  segmentSample: number;
  value: number | null;
};

export const EDGE_MIN = 0.05;
export const SAMPLE_MIN = 12;
export const P_MIN = 0.16;
export const SEP_MIN = 1.22;
export const FIELD_MIN = 6;
export const FIELD_MAX = 14;

const LADDER = [
  1.4, 1.5, 1.57, 1.67, 1.73, 1.8, 1.91, 2, 2.1, 2.25, 2.38, 2.5, 2.63, 2.75, 2.88, 3, 3.25,
  3.5, 3.75, 4, 4.33, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 9, 10, 11, 13, 15, 17, 21, 26, 34, 41, 51,
  67, 81,
];

const SILKS: Silk[] = [
  { a: "#1e3a5f", b: "#f4f1ea", pattern: "sash" },
  { a: "#7a1f2b", b: "#f2e2c4", pattern: "hoops" },
  { a: "#1f4d3a", b: "#e8d48b", pattern: "stars" },
  { a: "#2c2c2e", b: "#d8c4a8", pattern: "solid" },
  { a: "#3d4f8a", b: "#f4f4f7", pattern: "check" },
  { a: "#8a5a2b", b: "#f7f1e6", pattern: "sash" },
  { a: "#5c2d6e", b: "#e6d5f2", pattern: "hoops" },
  { a: "#6e2a2a", b: "#f4efe6", pattern: "stars" },
  { a: "#1c4b6e", b: "#d4e6f2", pattern: "solid" },
  { a: "#2f4f3e", b: "#f2f7f4", pattern: "check" },
  { a: "#6b3a2a", b: "#f3e6d8", pattern: "hoops" },
  { a: "#243044", b: "#c9a227", pattern: "sash" },
  { a: "#3e2f28", b: "#efe6d6", pattern: "stars" },
  { a: "#1f3d36", b: "#d8c4a8", pattern: "hoops" },
  { a: "#4a2c3a", b: "#f6efe4", pattern: "check" },
  { a: "#2a3a4a", b: "#e7d7b8", pattern: "solid" },
];

const JOCKEYS = [
  "A. Callan",
  "B. Dwyer",
  "C. Enright",
  "D. Fanning",
  "E. Gannon",
  "F. Hyland",
  "G. Ivers",
  "H. Joyce",
  "I. Kelleher",
  "J. Lawlor",
  "K. Mangan",
  "L. Noonan",
  "M. O'Hara",
  "N. Prendergast",
  "O. Quirke",
  "P. Redmond",
  "R. Spillane",
  "S. Tully",
  "T. Usher",
  "V. Ward",
  "W. Young",
  "A. Beirne",
  "B. Colgan",
  "C. Devlin",
  "D. Elwood",
  "E. Flanagan",
  "F. Gore",
  "G. Hall",
  "H. Irwin",
  "K. Lacey",
];

const TRAINERS = [
  "A. Bracken",
  "B. Conroy",
  "C. Delaney",
  "D. Furlong",
  "E. Gaffney",
  "F. Hennessy",
  "G. Ivers",
  "H. Jordan",
  "I. Kearns",
  "J. Lomax",
  "K. Murtagh",
  "L. Nestor",
  "M. O'Loughlin",
  "N. Phelan",
  "O. Quilter",
  "P. Raftery",
  "R. Sweeney",
  "S. Tynan",
  "T. Upton",
  "V. Walshe",
  "W. Young",
  "A. Behan",
  "B. Crowe",
  "C. Dineen",
  "D. Ennis",
];

const IE_JUMPS = [
  "Leopardstown",
  "Fairyhouse",
  "Punchestown",
  "Naas",
  "Navan",
  "Galway",
  "Cork",
  "Gowran Park",
  "Thurles",
  "Limerick",
  "Down Royal",
  "Clonmel",
  "Wexford",
  "Kilbeggan",
  "Listowel",
];

const GB_JUMPS = [
  "Cheltenham",
  "Ascot",
  "Newbury",
  "Haydock",
  "Aintree",
  "Kempton",
  "Sandown",
  "Exeter",
  "Wetherby",
  "Chepstow",
  "Fontwell",
  "Uttoxeter",
];

const PREFIXES = [
  "Parade Ring",
  "Harbour Light",
  "Dublin Bay",
  "Paddock Lane",
  "Morning Dew",
  "Castle Gate",
  "West Wind",
  "River Hymn",
  "Blackwater",
  "Open Ditch",
  "Village Green",
  "Quiet Man",
  "Last Orders",
  "Night Parade",
  "Copper Coast",
  "Soft Ground",
  "Yellow Jersey",
  "Ancient Order",
  "Silk Road",
  "Furlong",
  "Moss Glen",
  "Fair Day",
  "Stone Wall",
  "Hidden Valley",
];

const ADJ = [
  "Bold", "Quiet", "Royal", "Hidden", "Golden", "Silver", "Copper", "Northern", "Western",
  "Ancient", "Early", "Final", "Soft", "Dark", "Bright", "Rapid", "Steady", "Silent", "Wild",
  "Noble", "Misty", "Amber", "Scarlet", "Ivory", "Crystal", "Willow", "Cedar", "Rowan", "Hazel",
  "Holly", "Moss", "Fern", "Heather", "Clover", "Barley", "Flax", "Dusty", "Lucky", "Gentle", "Storm",
];

const NOUN = [
  "Approach", "Parade", "Valley", "Hedge", "Ditch", "Furlong", "Gallop", "Order", "Exchange",
  "Birch", "Wall", "Wind", "Light", "Star", "Bay", "Road", "Gate", "Court", "Hill", "Water",
  "Glen", "Fort", "Lane", "Field", "Meadow", "Harbour", "Quay", "Bridge", "Ford", "Ridge",
  "Moor", "Heath", "Down", "Silk", "Banner", "Crest", "Manor", "Lodge", "Abbey", "Tower",
];

type Title = { grade: string; discipline: Discipline; prize: number };

const JUMP_TITLES: Title[] = [
  { grade: "Maiden Hurdle", discipline: "Hurdle", prize: 12000 },
  { grade: "Novice Hurdle", discipline: "Hurdle", prize: 15000 },
  { grade: "Handicap Hurdle", discipline: "Hurdle", prize: 18000 },
  { grade: "Mares' Hurdle", discipline: "Hurdle", prize: 14000 },
  { grade: "Rated Hurdle", discipline: "Hurdle", prize: 16000 },
  { grade: "Beginners Chase", discipline: "Chase", prize: 13000 },
  { grade: "Novice Chase", discipline: "Chase", prize: 17000 },
  { grade: "Handicap Chase", discipline: "Chase", prize: 20000 },
  { grade: "Maiden Chase", discipline: "Chase", prize: 14000 },
  { grade: "National Hunt Flat", discipline: "Bumper", prize: 10000 },
];

const FLAT_TITLES: Title[] = [
  { grade: "Maiden", discipline: "Flat", prize: 10000 },
  { grade: "Handicap", discipline: "Flat", prize: 15000 },
  { grade: "Conditions Stakes", discipline: "Flat", prize: 14000 },
  { grade: "Fillies' Handicap", discipline: "Flat", prize: 13000 },
  { grade: "Claiming Stakes", discipline: "Flat", prize: 8000 },
];

const DIST_JUMPS = ["2m", "2m 1f", "2m 4f", "2m 6f", "3m", "3m 1f"];
const DIST_FLAT = ["5f", "6f", "7f", "1m", "1m 2f", "1m 4f", "1m 5f"];

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function rand() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!;
}

function softmax(xs: number[], temp: number) {
  const m = Math.max(...xs);
  const ex = xs.map((x) => Math.exp((x - m) / temp));
  const sum = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / sum);
}

function snap(decimal: number) {
  let best = LADDER[0]!;
  let bd = Infinity;
  for (const x of LADDER) {
    const d = Math.abs(Math.log(x) - Math.log(Math.max(decimal, 1.2)));
    if (d < bd) {
      bd = d;
      best = x;
    }
  }
  return best;
}

function sampleIndex(ps: number[], rng: () => number) {
  let r = rng();
  for (let i = 0; i < ps.length; i++) {
    r -= ps[i]!;
    if (r <= 0) return i;
  }
  return ps.length - 1;
}

function stones(pounds: number) {
  const lb = Math.max(112, Math.min(182, Math.round(pounds)));
  return `${Math.floor(lb / 14)}-${lb % 14}`;
}

function euro(n: number) {
  const grouped = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `€ ${grouped}`;
}

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formString(hist: string[]) {
  const last = hist.slice(-5);
  if (last.length === 0) return "—";
  if (last.length <= 3) return last.join("");
  return `${last.slice(0, -3).join("")}-${last.slice(-3).join("")}`;
}

function goingFor(ymd: string, flat: boolean, rng: () => number) {
  if (flat) return rng() < 0.82 ? "Standard" : "Standard a Lento";
  const t = (Date.parse(`${ymd}T12:00:00Z`) - Date.parse("2026-09-27T12:00:00Z")) / (42 * 86_400_000);
  const roll = rng();
  if (t < 0.35) {
    if (roll < 0.4) return "Bom a Macio";
    if (roll < 0.78) return "Cedente";
    return "Macio";
  }
  if (roll < 0.38) return "Macio";
  if (roll < 0.72) return "Pesado";
  return "Cedente";
}

function statusFor(offMs: number, rng: () => number): RaceStatus {
  const dt = offMs - DESK_MS;
  if (dt > 8 * 60 * 1000) return "upcoming";
  if (dt > -18 * 60 * 1000) return "off";
  if (dt > -3 * 60 * 60 * 1000 && rng() < 0.42) return "awaiting";
  if (dt > -30 * 60 * 60 * 1000 && rng() < 0.06) return "awaiting";
  return "settled";
}

type Roster = { trainer: string; silk: Silk; age: number; ability: number };
type Built = Omit<Race, "gates" | "qualified" | "segmentSample" | "value" | "pickName"> & {
  pickName: string;
};

function buildNames(rng: () => number) {
  const names: string[] = [];
  const used = new Set<string>();
  while (names.length < 480) {
    const name = `${pick(rng, ADJ)} ${pick(rng, NOUN)}`;
    if (used.has(name)) continue;
    used.add(name);
    names.push(name);
  }
  return names;
}

function disciplineLabel(d: Discipline) {
  if (d === "Hurdle") return "Obstáculos";
  if (d === "Chase") return "Steeple";
  if (d === "Bumper") return "NH Flat";
  return "Plano";
}

export function disciplinePt(d: Discipline) {
  return disciplineLabel(d);
}

function buildUniverse(): Race[] {
  const rng = mulberry32(0x54555246);
  const names = buildNames(rng);
  const roster = new Map<string, Roster>();
  const history = new Map<string, string[]>();
  const lastRun = new Map<string, string>();

  function ensure(name: string, ymd: string): Roster {
    let row = roster.get(name);
    if (!row) {
      const trainer = pick(rng, TRAINERS);
      const silk = SILKS[TRAINERS.indexOf(trainer) % SILKS.length]!;
      const age = 4 + Math.floor(rng() * 5);
      row = { trainer, silk, age, ability: 78 + rng() * 34 };
      roster.set(name, row);
    }
    void ymd;
    return row;
  }

  type Spec = {
    ymd: string;
    course: string;
    country: "IE" | "GB";
    flat: boolean;
    start: string;
    races: number;
  };

  const specs: Spec[] = [];
  let ie = 0;
  let gb = 0;
  for (let ymd = "2026-09-27"; ymd <= "2026-11-08"; ymd = addDays(ymd, 1)) {
    if (ymd === DESK_YMD) {
      specs.push({ ymd, course: "Navan", country: "IE", flat: false, start: "12:40", races: 8 });
      specs.push({ ymd, course: "Dundalk", country: "IE", flat: true, start: "16:45", races: 7 });
      continue;
    }
    const wd = weekday(ymd);
    if (wd === 6) {
      const course = IE_JUMPS[ie++ % IE_JUMPS.length]!;
      specs.push({ ymd, course, country: "IE", flat: false, start: "13:05", races: 7 });
    } else if (wd === 0) {
      const course = IE_JUMPS[ie++ % IE_JUMPS.length]!;
      specs.push({ ymd, course, country: "IE", flat: false, start: "12:35", races: 6 });
    } else if (wd === 5) {
      specs.push({ ymd, course: "Dundalk", country: "IE", flat: true, start: "16:45", races: 6 });
    } else if (wd === 3) {
      const course = GB_JUMPS[gb++ % GB_JUMPS.length]!;
      specs.push({ ymd, course, country: "GB", flat: false, start: "13:20", races: 5 });
    }
  }

  const built: Built[] = [];
  const step = 33;

  for (const spec of specs) {
    const going = goingFor(spec.ymd, spec.flat, rng);
    const usedToday = new Set<string>();
    const prefixes = [...PREFIXES];
    let time = spec.start;
    for (let r = 0; r < spec.races; r++) {
      const title = spec.flat ? pick(rng, FLAT_TITLES) : pick(rng, JUMP_TITLES);
      const prefix = prefixes.splice(Math.floor(rng() * prefixes.length), 1)[0] ?? "Turf";
      const distance = spec.flat ? pick(rng, DIST_FLAT) : pick(rng, DIST_JUMPS);
      const n = 5 + Math.floor(rng() * (spec.flat ? 10 : 12));
      const eligible = names.filter((name) => {
        if (usedToday.has(name)) return false;
        const last = lastRun.get(name);
        return !last || daysBetween(last, spec.ymd) >= 11;
      });
      const pool = eligible.length >= n ? eligible : names.filter((name) => !usedToday.has(name));
      const field: string[] = [];
      const guard = new Set<string>();
      while (field.length < n && guard.size < pool.length) {
        const name = pick(rng, pool);
        if (guard.has(name)) continue;
        guard.add(name);
        field.push(name);
      }

      const runners = field.map((name) => ensure(name, spec.ymd));
      const abilities = runners.map((row) => row.ability + (rng() - 0.5) * 1.2);
      const modelLogits = abilities.map((a) => a / 8 + (rng() - 0.5) * 0.35);
      const trueP = softmax(
        abilities.map((a) => a / 8),
        1.05,
      );
      let modelP = softmax(modelLogits, 1);
      const sumFix = modelP.reduce((a, b) => a + b, 0);
      modelP = modelP.map((p) => p / sumFix);
      const rounded = modelP.map((p) => Math.max(0.004, Math.round(p * 10000) / 10000));
      const drift = 1 - rounded.reduce((a, b) => a + b, 0);
      const top = rounded.indexOf(Math.max(...rounded));
      rounded[top] = Math.round((rounded[top]! + drift) * 10000) / 10000;

      const marketLogits = abilities.map((a) => a / 8 + (rng() - 0.5) * 0.9);
      const rawMarket = softmax(marketLogits, 1);
      const meanP = 1 / runners.length;
      const biased = rawMarket.map((p) => (p >= meanP ? p * 1.08 : p * 0.86));
      const biasSum = biased.reduce((a, b) => a + b, 0);
      const market = biased.map((p) => p / biasSum);
      const missing = rng() < 0.16;
      const odds = missing
        ? runners.map(() => null)
        : market.map((p) => snap(1 / Math.max(0.025, p * 1.18)));

      const iso = offIso(spec.ymd, time);
      const offMs = Date.parse(iso);
      const status = statusFor(offMs, rng);
      const settled = status === "settled";
      let positions: (number | null)[] = runners.map(() => null);
      let sps: (number | null)[] = runners.map(() => null);
      if (settled) {
        const winner = sampleIndex(trueP, rng);
        const order = abilities
          .map((a, i) => ({ i, s: a + (rng() - 0.5) * 6 }))
          .sort((a, b) => b.s - a.s)
          .map((x) => x.i)
          .filter((i) => i !== winner);
        order.unshift(winner);
        positions = runners.map(() => null);
        order.forEach((idx, place) => {
          positions[idx] = place + 1;
        });
        sps = odds.map((o) => {
          if (o == null) {
            const idx = LADDER[Math.floor(rng() * 18) + 4]!;
            return idx;
          }
          const at = LADDER.indexOf(o);
          const move = Math.round((rng() - 0.55) * 2.4);
          return LADDER[Math.max(0, Math.min(LADDER.length - 1, at + move))]!;
        });
      }

      const horses: Horse[] = runners.map((row, i) => {
        const name = field[i]!;
        const hist = history.get(name) ?? [];
        const pos = positions[i];
        const handicap = title.grade.includes("Handicap") || title.grade.includes("Rated");
        return {
          name,
          cloth: i + 1,
          jockey: pick(rng, JOCKEYS),
          trainer: row.trainer,
          age: row.age,
          weight: stones(row.ability + (spec.flat ? 48 : 78) + (rng() - 0.5) * 6),
          or: handicap ? Math.round(row.ability) : null,
          form: formString(hist),
          silk: row.silk,
          modelP: rounded[i]!,
          odds: odds[i] ?? null,
          sp: sps[i] ?? null,
          position: pos,
        };
      });

      const pickIdx = rounded.indexOf(Math.max(...rounded));
      built.push({
        id: `${slug(spec.course)}-${spec.ymd}-${time.replace(":", "")}`,
        course: spec.course,
        country: spec.country,
        date: spec.ymd,
        time,
        offIso: iso,
        name: `${prefix} ${title.grade}`,
        discipline: title.discipline,
        distance,
        going,
        grade: title.grade,
        prize: euro(title.prize),
        horses,
        status,
        pickName: field[pickIdx]!,
      });

      field.forEach((name, i) => {
        usedToday.add(name);
        lastRun.set(name, spec.ymd);
        if (settled && positions[i] != null) {
          const pos = positions[i]!;
          const hist = history.get(name) ?? [];
          hist.push(pos <= 9 ? String(pos) : "0");
          history.set(name, hist);
          const row = roster.get(name)!;
          const delta = ((n / 2 - pos) / n) * 1.6 + (rng() - 0.5) * 0.3;
          row.ability = Math.max(68, Math.min(124, row.ability + delta));
        }
      });

      time = addMinutes(time, spec.flat ? 30 : step);
    }
  }

  built.sort((a, b) => Date.parse(a.offIso) - Date.parse(b.offIso));

  const settledByType = new Map<Discipline, number>();
  return built.map((race) => {
    const sample = settledByType.get(race.discipline) ?? 0;
    if (race.status === "settled") {
      settledByType.set(race.discipline, sample + 1);
    }
    const ranked = [...race.horses].sort((a, b) => b.modelP - a.modelP || a.cloth - b.cloth);
    const pickHorse = ranked[0]!;
    const second = ranked[1]?.modelP ?? 0;
    const sep = second > 0 ? pickHorse.modelP / second : Infinity;
    const value = pickHorse.odds != null ? pickHorse.modelP * pickHorse.odds - 1 : null;
    const gates: Gate[] = [
      {
        code: "INSUFFICIENT_DATA",
        title: "Calibração do segmento",
        why:
          race.discipline === "Bumper"
            ? "National Hunt Flat fica de fora até haver amostra própria."
            : `Precisa de pelo menos ${SAMPLE_MIN} corridas de ${disciplineLabel(race.discipline).toLowerCase()} já liquidadas antes desta. Agora: ${sample}.`,
        passed: race.discipline !== "Bumper" && sample >= SAMPLE_MIN,
      },
      {
        code: "SEM_COTACAO",
        title: "Cotação real da Paddy Power",
        why: "Decimal travado antes da partida. Sem cotação real: SEM APOSTA.",
        passed: pickHorse.odds != null,
      },
      {
        code: "CAMPO",
        title: "Tamanho do campo",
        why: `Entre ${FIELD_MIN} e ${FIELD_MAX} cavalos. Este campo tem ${race.horses.length}.`,
        passed: race.horses.length >= FIELD_MIN && race.horses.length <= FIELD_MAX,
      },
      {
        code: "PROBABILIDADE",
        title: "Probabilidade do escolhido",
        why: `A leitura do primeiro tem de ser pelo menos ${Math.round(P_MIN * 100)}%.`,
        passed: pickHorse.modelP >= P_MIN,
      },
      {
        code: "CORRIDA_ABERTA",
        title: "Separação do segundo",
        why: `O primeiro tem de valer pelo menos ${SEP_MIN.toFixed(2).replace(".", ",")}× o segundo.`,
        passed: sep >= SEP_MIN,
      },
      {
        code: "VANTAGEM",
        title: "Vantagem mínima",
        why: "Valor = probabilidade × cotação − 1. Abaixo de 5%: SEM APOSTA.",
        passed: value != null && value >= EDGE_MIN,
      },
    ];
    return {
      ...race,
      pickName: pickHorse.name,
      qualified: gates.every((g) => g.passed),
      gates,
      segmentSample: sample,
      value,
    };
  });
}

export const races: Race[] = buildUniverse();

const byId = new Map(races.map((r) => [r.id, r]));

export function raceById(id: string) {
  return byId.get(id) ?? null;
}

export function pickOf(race: Race) {
  return race.horses.find((h) => h.name === race.pickName) ?? race.horses[0]!;
}

export type Ledger = {
  locked: number;
  periodLabel: string;
  qualified: number;
  qualifiedNote: string | null;
  settled: number;
  brier: number | null;
  logloss: number | null;
  hitRate: number | null;
  roiN: number;
  roi: number | null;
  clvN: number;
  clv: number | null;
  withRealOdd: number;
  withoutRealOdd: number;
  awaiting: number;
};

function brierOf(race: Race) {
  let s = 0;
  for (const h of race.horses) {
    const y = h.position === 1 ? 1 : 0;
    s += (h.modelP - y) ** 2;
  }
  return s;
}

export function ledgerOf(list: Race[]): Ledger {
  const dates = list.map((r) => r.date).sort();
  const settled = list.filter((r) => r.status === "settled" && r.horses.some((h) => h.position === 1));
  const brier = settled.length ? settled.reduce((a, r) => a + brierOf(r), 0) / settled.length : null;
  const logloss = settled.length
    ? settled.reduce((a, r) => {
        const w = r.horses.find((h) => h.position === 1);
        const p = Math.min(1 - 1e-6, Math.max(1e-4, w?.modelP ?? 1e-4));
        return a + -Math.log(p);
      }, 0) / settled.length
    : null;
  const hits = settled.filter((r) => pickOf(r).position === 1).length;
  const roiRows = settled.filter((r) => pickOf(r).odds != null);
  const profits = roiRows.map((r) => {
    const h = pickOf(r);
    return h.position === 1 ? (h.odds ?? 1) - 1 : -1;
  });
  const roi = profits.length ? profits.reduce((a, b) => a + b, 0) / profits.length : null;
  const clvRows = settled.filter((r) => {
    const h = pickOf(r);
    return h.odds != null && h.sp != null;
  });
  const clv = clvRows.length
    ? clvRows.reduce((a, r) => {
        const h = pickOf(r);
        return a + ((h.odds ?? 1) / (h.sp ?? 1) - 1);
      }, 0) / clvRows.length
    : null;
  const withRealOdd = list.filter((r) => pickOf(r).odds != null).length;
  const qualified = list.filter((r) => r.qualified);
  let qualifiedNote: string | null = null;
  if (qualified.length === 0) {
    const counts = new Map<string, number>();
    for (const r of list) {
      const fail = r.gates.find((g) => !g.passed);
      if (!fail) continue;
      counts.set(fail.code, (counts.get(fail.code) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    qualifiedNote =
      top === "INSUFFICIENT_DATA"
        ? "Nenhuma selecção QUALIFICADA registada (calibração INSUFFICIENT_DATA bloqueia qualificação)."
        : "Nenhuma selecção QUALIFICADA registada. Os controlos recusaram o universo inteiro.";
  }
  return {
    locked: list.length,
    periodLabel: dates.length ? `${fmtShort(dates[0]!)} – ${fmtShort(dates[dates.length - 1]!)}` : "—",
    qualified: qualified.length,
    qualifiedNote,
    settled: settled.length,
    brier,
    logloss,
    hitRate: settled.length ? hits / settled.length : null,
    roiN: roiRows.length,
    roi,
    clvN: clvRows.length,
    clv,
    withRealOdd,
    withoutRealOdd: list.length - withRealOdd,
    awaiting: list.length - settled.length,
  };
}

export const ledger = ledgerOf(races);

export function racesOn(ymd: string) {
  return races.filter((r) => r.date === ymd).sort((a, b) => a.time.localeCompare(b.time));
}

export const todayRaces = racesOn(DESK_YMD);
