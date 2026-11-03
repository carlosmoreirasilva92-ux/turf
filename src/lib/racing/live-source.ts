import { dublinYmd } from "./time.ts";
import { parseLiveDay, parseLiveRace, shortestShown, type LiveDay, type LiveRace, type LiveRaceSummary } from "./live-card.ts";

const LIST = "https://www.sportinglife.com/api/horse-racing/racing/racecards/";
const RACE = "https://www.sportinglife.com/api/horse-racing/race/";
const DAY_TTL = 45_000;
const RACE_TTL = 45_000;
const BOARD_TTL = 45_000;

type Cache<T> = { at: number; value: T };

const days = new Map<string, Cache<LiveDay>>();
const races = new Map<string, Cache<LiveRace>>();
const boards = new Map<string, Cache<LiveBoard>>();

export type LiveBoardRace = LiveRaceSummary & {
  shownName: string | null;
  shownJockey: string | null;
  shownTrainer: string | null;
  shownFractional: string | null;
  shownDecimal: number | null;
  field: number | null;
};

export type LiveBoard = {
  date: string;
  receivedAt: string;
  races: LiveBoardRace[];
};

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

export type LiveResult<T> = { ok: true; value: T } | { ok: false; reason: string };

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "TURF/1.0 (caderno; leitura do cartão público)" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`A fonte respondeu ${response.status}.`);
  return response.json();
}

export async function fetchLiveDay(now = new Date()): Promise<LiveResult<LiveDay>> {
  const date = dublinYmd(now);
  const hit = days.get(date);
  if (hit && now.getTime() - hit.at < DAY_TTL) return { ok: true, value: hit.value };
  try {
    const payload = await readJson(`${LIST}${date}`);
    const parsed = parseLiveDay(payload, now.toISOString(), date);
    if (!parsed.ok) return parsed;
    days.set(date, { at: now.getTime(), value: parsed.day });
    return { ok: true, value: parsed.day };
  } catch {
    return {
      ok: false,
      reason: "O cartão público não respondeu. A demonstração não foi usada no lugar.",
    };
  }
}

export async function fetchLiveRace(id: string, now = new Date()): Promise<LiveResult<LiveRace>> {
  if (!/^\d{1,12}$/.test(id)) return { ok: false, reason: "Corrida inválida." };
  const hit = races.get(id);
  if (hit && now.getTime() - hit.at < RACE_TTL) return { ok: true, value: hit.value };
  try {
    const payload = await readJson(`${RACE}${id}`);
    const parsed = parseLiveRace(payload, now.toISOString());
    if (!parsed.ok) return parsed;
    if (parsed.race.country === "—" || !parsed.race.going) {
      const day = await fetchLiveDay(now);
      if (day.ok) {
        for (const meeting of day.value.meetings) {
          const listed = meeting.races.find((race) => race.id === id);
          if (!listed) continue;
          if (parsed.race.country === "—") parsed.race.country = listed.country;
          if (!parsed.race.going && listed.going) parsed.race.going = listed.going;
          break;
        }
      }
    }
    races.set(id, { at: now.getTime(), value: parsed.race });
    return { ok: true, value: parsed.race };
  } catch {
    return {
      ok: false,
      reason: "A ficha pública não respondeu. Nada foi inventado.",
    };
  }
}

export async function fetchLiveBoard(now = new Date()): Promise<LiveResult<LiveBoard>> {
  const date = dublinYmd(now);
  const hit = boards.get(date);
  if (hit && now.getTime() - hit.at < BOARD_TTL) return { ok: true, value: hit.value };
  const day = await fetchLiveDay(now);
  if (!day.ok) return day;
  const listed = day.value.meetings.flatMap((meeting) => meeting.races).filter((race) => race.country === "IE" || race.country === "GB");
  const detailed = await mapPool(listed, 4, async (race) => {
    const fiche = await fetchLiveRace(race.id, now);
    const shown = fiche.ok ? shortestShown(fiche.value.runners) : null;
    return {
      ...race,
      going: race.going || (fiche.ok ? fiche.value.going : null),
      shownName: shown?.name ?? null,
      shownJockey: shown?.jockey ?? null,
      shownTrainer: shown?.trainer ?? null,
      shownFractional: shown?.fractional ?? null,
      shownDecimal: shown?.decimal ?? null,
      field: fiche.ok ? fiche.value.runners.length : race.runnersDeclared,
    } satisfies LiveBoardRace;
  });
  const board: LiveBoard = { date, receivedAt: new Date().toISOString(), races: detailed };
  boards.set(date, { at: Date.now(), value: board });
  return { ok: true, value: board };
}
