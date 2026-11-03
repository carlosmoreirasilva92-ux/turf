/**
 * Reads the public racecard JSON published for anonymous visitors.
 * Missing prices, types and results stay missing. Nothing here is a model pick.
 */

import { zonedToUtc } from "./time.ts";

export const LIVE_SOURCE = "cartão público";
export const LIVE_BOOK = "cartão publicado";

export type LiveRaceSummary = {
  id: string;
  course: string;
  country: string;
  name: string;
  time: string | null;
  date: string;
  offAt: string | null;
  distance: string | null;
  going: string | null;
  handicap: boolean;
  discipline: "Hurdle" | "Chase" | "Flat" | "Bumper" | null;
  stage: string;
  runnersDeclared: number | null;
};

export type LiveMeeting = {
  id: string;
  course: string;
  country: string;
  going: string | null;
  status: string;
  races: LiveRaceSummary[];
};

export type LiveDay = {
  date: string;
  receivedAt: string;
  source: typeof LIVE_SOURCE;
  meetings: LiveMeeting[];
};

export type LiveGoingRun = {
  offAt: string;
  going: string | null;
  course: string | null;
  distance: string | null;
  position: number | null;
};

export type LiveRunner = {
  id: string;
  name: string;
  cloth: number | null;
  jockey: string | null;
  trainer: string | null;
  form: string | null;
  or: number | null;
  weightLb: number | null;
  status: string;
  position: number | null;
  fractional: string | null;
  decimal: number | null;
  goingRuns: LiveGoingRun[];
};

export type LiveRace = {
  id: string;
  course: string;
  country: string;
  name: string;
  date: string;
  time: string | null;
  offAt: string | null;
  distance: string | null;
  going: string | null;
  handicap: boolean;
  discipline: LiveRaceSummary["discipline"];
  stage: string;
  receivedAt: string;
  runners: LiveRunner[];
};

export function fractionalToDecimal(text: string | null | undefined): number | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (/^(evs|evens)$/i.test(trimmed)) return 2;
  const match = /^(\d+)\s*\/\s*(\d+)$/.exec(trimmed);
  if (!match) return null;
  const over = Number(match[1]);
  const under = Number(match[2]);
  if (!(under > 0)) return null;
  const decimal = 1 + over / under;
  if (!(decimal > 1) || !Number.isFinite(decimal)) return null;
  return Math.round(decimal * 1000) / 1000;
}

export function stonesToLb(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = /^(\d+)-(\d+)$/.exec(text.trim());
  if (!match) return null;
  const stones = Number(match[1]);
  const pounds = Number(match[2]);
  if (pounds > 13) return null;
  return stones * 14 + pounds;
}

export function countryCode(longName: string | null | undefined, shortName?: string | null): string {
  const short = (shortName ?? "").toUpperCase();
  const name = (longName ?? "").toLowerCase();
  if (["ENG", "SCO", "WAL", "GB", "GBR"].includes(short) || /england|scotland|wales|britain/.test(name)) return "GB";
  if (["IRE", "IRL", "EIR", "NI"].includes(short) || /eire|ireland/.test(name)) return "IE";
  return short || longName || "—";
}

export function disciplineFromName(name: string): LiveRaceSummary["discipline"] {
  const text = name.toLowerCase();
  if (/\b(chase|steeplechase)\b/.test(text)) return "Chase";
  if (/\bhurdle\b/.test(text)) return "Hurdle";
  if (/\b(bumper|nh flat|national hunt flat)\b/.test(text)) return "Bumper";
  if (/\bflat\b/.test(text)) return "Flat";
  return null;
}

export function stageLabel(stage: string): string {
  const known: Record<string, string> = {
    DORMANT: "Ainda não largou",
    OFF: "A largar",
    RESULT: "Resultado publicado",
    WEIGHED_IN: "Pesagem confirmada",
    ABANDONED: "Abandonada",
    FINISHED: "Terminada",
  };
  return known[stage] ?? `Estado da fonte: ${stage || "não indicado"}`;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function obj(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function clock(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}:${match[2]}` : null;
}

function offOf(date: string | null, time: string | null): string | null {
  if (!date || !time) return null;
  const zoned = zonedToUtc(date, time);
  return zoned.ok ? zoned.utc : null;
}

export function parseLiveDay(value: unknown, receivedAt: string, date: string): { ok: true; day: LiveDay } | { ok: false; reason: string } {
  if (!Array.isArray(value)) return { ok: false, reason: "A fonte não devolveu uma lista de reuniões." };
  const meetings: LiveMeeting[] = [];
  for (const raw of value) {
    const meeting = obj(raw);
    const summary = obj(meeting?.meeting_summary);
    const course = obj(summary?.course);
    const courseName = str(course?.name);
    if (!summary || !courseName) continue;
    const country = countryCode(str(obj(course?.country)?.long_name), null);
    const races: LiveRaceSummary[] = [];
    const list = Array.isArray(meeting?.races) ? meeting.races : [];
    for (const raceRaw of list) {
      const race = obj(raceRaw);
      const id = race?.race_summary_reference && obj(race.race_summary_reference)?.id;
      const name = str(race?.name);
      if (!race || (typeof id !== "number" && typeof id !== "string") || !name) continue;
      const time = clock(str(race.time));
      const raceDate = str(race.date) ?? date;
      races.push({
        id: String(id),
        course: str(race.course_name) ?? courseName,
        country: countryCode(null, str(race.country_short_name)) === "—" ? country : countryCode(null, str(race.country_short_name)),
        name,
        time,
        date: raceDate,
        offAt: offOf(raceDate, time),
        distance: str(race.distance),
        going: str(race.going) || str(summary.going),
        handicap: race.has_handicap === true,
        discipline: disciplineFromName(name),
        stage: str(race.race_stage) ?? "não indicado",
        runnersDeclared: typeof race.ride_count === "number" ? race.ride_count : null,
      });
    }
    races.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    meetings.push({
      id: String(obj(summary.meeting_reference)?.id ?? courseName),
      course: courseName,
      country,
      going: str(summary.going),
      status: str(summary.status) ?? "não indicado",
      races,
    });
  }
  meetings.sort((a, b) => a.course.localeCompare(b.course, "pt"));
  return { ok: true, day: { date, receivedAt, source: LIVE_SOURCE, meetings } };
}

export function parseLiveRace(value: unknown, receivedAt: string): { ok: true; race: LiveRace } | { ok: false; reason: string } {
  const root = obj(value);
  const summary = obj(root?.race_summary);
  const id = summary?.race_summary_reference && obj(summary.race_summary_reference)?.id;
  const name = str(summary?.name);
  if (!summary || (typeof id !== "number" && typeof id !== "string") || !name) {
    return { ok: false, reason: "A ficha publicada não tem corrida reconhecível." };
  }
  const date = str(summary.date) ?? "";
  const time = clock(str(summary.time));
  const offAt = offOf(date, time);
  const country = countryCode(null, str(summary.country_short_name));
  const rides = Array.isArray(root?.rides) ? root.rides : [];
  const runners: LiveRunner[] = [];
  for (const rideRaw of rides) {
    const ride = obj(rideRaw);
    const horse = obj(ride?.horse);
    if (!ride || !horse) continue;
    const horseName = str(horse.name);
    if (!horseName) continue;
    const rideId = obj(ride.ride_reference)?.id;
    const fractional = str(obj(ride.betting)?.current_odds);
    const position = typeof ride.finish_position === "number" && ride.finish_position > 0 ? ride.finish_position : null;
    const goingRuns: LiveGoingRun[] = [];
    const history = Array.isArray(horse.previous_results) ? horse.previous_results : [];
    for (const priorRaw of history) {
      const prior = obj(priorRaw);
      const priorDate = str(prior?.date);
      const priorClock = clock(str(prior?.time));
      const priorOff = offOf(priorDate, priorClock);
      if (!priorOff) continue;
      if (offAt && priorOff >= offAt) continue;
      const priorPosition = typeof prior?.position === "number" && prior.position > 0 ? prior.position : null;
      goingRuns.push({
        offAt: priorOff,
        going: str(prior?.going),
        course: str(prior?.course_name),
        distance: str(prior?.distance),
        position: priorPosition,
      });
    }
    runners.push({
      id: String(rideId ?? horseName),
      name: horseName,
      cloth: typeof ride.cloth_number === "number" ? ride.cloth_number : null,
      jockey: str(obj(ride.jockey)?.name),
      trainer: str(obj(ride.trainer)?.name),
      form: str(obj(horse.formsummary)?.display_text),
      or: typeof ride.official_rating === "number" ? ride.official_rating : null,
      weightLb: stonesToLb(typeof ride.handicap === "string" ? ride.handicap : null),
      status: str(ride.ride_status) ?? "não indicado",
      position,
      fractional,
      decimal: fractionalToDecimal(fractional),
      goingRuns,
    });
  }
  runners.sort((a, b) => (a.cloth ?? 99) - (b.cloth ?? 99));
  return {
    ok: true,
    race: {
      id: String(id),
      course: str(summary.course_name) ?? "—",
      country: country === "—" ? "—" : country,
      name,
      date,
      time,
      offAt,
      distance: str(summary.distance),
      going: str(summary.going),
      handicap: summary.has_handicap === true,
      discipline: disciplineFromName(name),
      stage: str(summary.race_stage) ?? "não indicado",
      receivedAt,
      runners,
    },
  };
}
