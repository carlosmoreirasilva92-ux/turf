import { dublinYmd } from "./time.ts";
import { parseLiveDay, parseLiveRace, type LiveDay, type LiveRace } from "./live-card.ts";

const LIST = "https://www.sportinglife.com/api/horse-racing/racing/racecards/";
const RACE = "https://www.sportinglife.com/api/horse-racing/race/";
const DAY_TTL = 180_000;
const RACE_TTL = 90_000;

type Cache<T> = { at: number; value: T };

const days = new Map<string, Cache<LiveDay>>();
const races = new Map<string, Cache<LiveRace>>();

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
