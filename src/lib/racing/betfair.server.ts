import { env } from "../env.server.ts";
import { joinExchange, type BetfairView, type CardRace, type ExchangeMarket } from "./betfair-join.ts";
import { fetchLiveBoard, fetchLiveRace } from "./live-source.ts";
import { dublinYmd, zonedToUtc } from "./time.ts";

const LOGIN = "https://identitysso.betfair.com/api/login";
const RPC = "https://api.betfair.com/exchange/betting/json-rpc/v1";
const TTL = 60_000;

export type { BetfairView } from "./betfair-join.ts";

type Session = { token: string; at: number };
let session: Session | null = null;
let cache: { at: number; value: BetfairView } | null = null;

function secrets() {
  const appKey = env("BETFAIR_APP_KEY");
  const username = env("BETFAIR_USERNAME");
  const password = env("BETFAIR_PASSWORD");
  if (!appKey || !username || !password) return null;
  return { appKey, username, password };
}

function nextYmd(ymd: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1));
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  const day = String(next.getUTCDate()).padStart(2, "0");
  return `${next.getUTCFullYear()}-${month}-${day}`;
}

function dublinBounds(now: Date): { from: string; to: string } {
  const ymd = dublinYmd(now);
  const start = zonedToUtc(ymd, "00:00");
  const endYmd = nextYmd(ymd);
  const end = endYmd ? zonedToUtc(endYmd, "00:00") : { ok: false as const, reason: "invalid" as const };
  if (start.ok && end.ok) return { from: start.utc, to: end.utc };
  const from = new Date(now);
  from.setUTCHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: new Date(from.getTime() + 86_400_000).toISOString() };
}

async function login(appKey: string, username: string, password: string): Promise<string> {
  const response = await fetch(LOGIN, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Application": appKey,
    },
    body: new URLSearchParams({ username, password }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("login-http");
  const payload = (await response.json()) as { status?: string; token?: string };
  if (payload.status !== "SUCCESS" || !payload.token) throw new Error("login-rejected");
  session = { token: payload.token, at: Date.now() };
  return payload.token;
}

async function tokenFor(appKey: string, username: string, password: string, force = false): Promise<string> {
  if (!force && session && Date.now() - session.at < 3 * 60 * 60 * 1000) return session.token;
  return login(appKey, username, password);
}

type RpcError = { data?: { APINGException?: { errorCode?: string } } };

async function rpc(appKey: string, token: string, method: string, params: unknown): Promise<unknown> {
  const response = await fetch(RPC, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Application": appKey,
      "X-Authentication": token,
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: `SportsAPING/v1.0/${method}`, params, id: 1 }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("rpc-http");
  const payload = (await response.json()) as { result?: unknown; error?: RpcError };
  const code = payload.error?.data?.APINGException?.errorCode;
  if (code === "INVALID_SESSION_INFORMATION") throw new Error("session");
  if (payload.error) throw new Error("rpc");
  return payload.result;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseMarkets(catalogue: unknown, books: Map<string, unknown>): ExchangeMarket[] {
  if (!Array.isArray(catalogue)) return [];
  const markets: ExchangeMarket[] = [];
  for (const row of catalogue) {
    if (!row || typeof row !== "object") continue;
    const market = row as Record<string, unknown>;
    const marketId = str(market.marketId);
    const event = market.event && typeof market.event === "object" ? (market.event as Record<string, unknown>) : {};
    const venue = str(event.venue) ?? str(event.name);
    const start = str(market.marketStartTime);
    if (!marketId || !venue || !start) continue;
    const described = new Map<number, { name: string; cloth: number | null }>();
    if (Array.isArray(market.runners)) {
      for (const runner of market.runners) {
        if (!runner || typeof runner !== "object") continue;
        const item = runner as Record<string, unknown>;
        const selectionId = num(item.selectionId);
        const name = str(item.runnerName);
        if (selectionId == null || !name) continue;
        const meta = item.metadata && typeof item.metadata === "object" ? (item.metadata as Record<string, unknown>) : {};
        const cloth = Number(str(meta.CLOTH_NUMBER));
        described.set(selectionId, { name, cloth: Number.isInteger(cloth) ? cloth : null });
      }
    }
    const book = books.get(marketId);
    const bookRunners = book && typeof book === "object" && Array.isArray((book as { runners?: unknown }).runners)
      ? ((book as { runners: unknown[] }).runners)
      : [];
    const runners: ExchangeMarket["runners"] = [];
    for (const runner of bookRunners) {
      if (!runner || typeof runner !== "object") continue;
      const item = runner as Record<string, unknown>;
      const selectionId = num(item.selectionId);
      const describedRunner = selectionId == null ? undefined : described.get(selectionId);
      if (!describedRunner) continue;
      const ex = item.ex && typeof item.ex === "object" ? (item.ex as Record<string, unknown>) : {};
      const offers = Array.isArray(ex.availableToBack) ? ex.availableToBack : [];
      const first = offers[0] && typeof offers[0] === "object" ? (offers[0] as Record<string, unknown>) : null;
      runners.push({
        name: describedRunner.name,
        cloth: describedRunner.cloth,
        back: first ? num(first.price) : null,
        status: str(item.status) ?? "UNKNOWN",
      });
    }
    markets.push({ venue, start, runners });
  }
  return markets;
}

async function loadMarkets(now: Date, creds: { appKey: string; username: string; password: string }): Promise<ExchangeMarket[]> {
  const bounds = dublinBounds(now);
  const call = async (force: boolean) => {
    const token = await tokenFor(creds.appKey, creds.username, creds.password, force);
    const catalogue = await rpc(creds.appKey, token, "listMarketCatalogue", {
      filter: {
        eventTypeIds: ["7"],
        marketCountries: ["IE", "GB"],
        marketTypeCodes: ["WIN"],
        marketStartTime: bounds,
      },
      marketProjection: ["RUNNER_DESCRIPTION", "RUNNER_METADATA", "EVENT", "MARKET_START_TIME"],
      sort: "FIRST_TO_START",
      maxResults: "400",
    });
    const ids = Array.isArray(catalogue)
      ? catalogue
          .map((row) => (row && typeof row === "object" ? str((row as { marketId?: unknown }).marketId) : null))
          .filter((id): id is string => Boolean(id))
      : [];
    const books = new Map<string, unknown>();
    for (let index = 0; index < ids.length; index += 25) {
      const slice = ids.slice(index, index + 25);
      const result = await rpc(creds.appKey, token, "listMarketBook", {
        marketIds: slice,
        priceProjection: { priceData: ["EX_BEST_OFFERS"], exBestOffersOverrides: { bestPricesDepth: 1 } },
      });
      if (!Array.isArray(result)) continue;
      for (const book of result) {
        if (!book || typeof book !== "object") continue;
        const id = str((book as { marketId?: unknown }).marketId);
        if (id) books.set(id, book);
      }
    }
    return parseMarkets(catalogue, books);
  };
  try {
    return await call(false);
  } catch (error) {
    if (error instanceof Error && error.message === "session") {
      session = null;
      return call(true);
    }
    throw error;
  }
}

async function cardRaces(now: Date): Promise<CardRace[] | null> {
  const board = await fetchLiveBoard(now);
  if (!board.ok) return null;
  const races: CardRace[] = [];
  for (const race of board.value.races) {
    const fiche = await fetchLiveRace(race.id, now);
    if (!fiche.ok) continue;
    races.push({
      id: race.id,
      course: race.course,
      time: race.time,
      offAt: fiche.value.offAt ?? race.offAt,
      runners: fiche.value.runners.map((runner) => ({
        name: runner.name,
        cloth: runner.cloth,
        decimal: runner.decimal,
        fractional: runner.fractional,
        status: runner.status,
      })),
    });
  }
  return races;
}

export async function fetchBetfairOverlay(now = new Date()): Promise<BetfairView> {
  if (cache && now.getTime() - cache.at < TTL) return cache.value;
  const creds = secrets();
  if (!creds) {
    return { ok: false, reason: "A Betfair Exchange ainda não tem chave neste servidor. O cartão público mantém-se." };
  }
  const races = await cardRaces(now);
  if (!races) {
    return { ok: false, reason: "A Betfair Exchange não respondeu. O cartão público mantém-se." };
  }
  try {
    const markets = await loadMarkets(now, creds);
    const joined = joinExchange(races, markets);
    const value: BetfairView = {
      ok: true,
      receivedAt: new Date().toISOString(),
      notice: "Preços de referência: Betfair Exchange (atraso de alguns segundos).",
      ...joined,
    };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return { ok: false, reason: "A Betfair Exchange não respondeu. O cartão público mantém-se." };
  }
}
