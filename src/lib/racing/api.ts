import { createServerFn } from "@tanstack/react-start";
import { createHash } from "node:crypto";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { bookMetrics, exportBook, importCard, listRaces, raceCard, recordPrediction, recordResult, toggleFavorite } from "./ledger.ts";
import { providerState } from "./providers.ts";

const DISCIPLINES = new Set(["Hurdle", "Chase", "Flat", "Bumper"]);
const RESULT_STATUS = new Set(["provisional", "official", "amended", "void", "abandoned"]);

function keyOf(value: unknown) {
  if (typeof value !== "object" || value === null) return "";
  const key = (value as { importKey?: unknown }).importKey;
  return typeof key === "string" && key.trim().length > 0 && key.length <= 80 ? key.trim() : "";
}

export const importUserCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { body: unknown; importKey: string }) => data)
  .handler(async ({ context, data }) => {
    const importKey = keyOf(data);
    if (!importKey || typeof data?.body !== "object" || data.body === null) {
      return { ok: false as const, errors: [{ path: "body", message: "Falta o cartão ou a chave de importação." }] };
    }
    return importCard(await getSql(), context.userId, data.body, importKey);
  });

export const listUserRaces = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { q?: string; country?: string; discipline?: string; before?: string | null }) => data ?? {})
  .handler(async ({ context, data }) => {
    const q = typeof data?.q === "string" ? data.q.slice(0, 80) : "";
    const country = data?.country === "IE" || data?.country === "GB" ? data.country : "";
    const discipline = typeof data?.discipline === "string" && DISCIPLINES.has(data.discipline) ? data.discipline : "";
    return listRaces(await getSql(), context.userId, { q, country, discipline, before: data?.before ?? null });
  });

export const userRace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id?: string }) => data)
  .handler(async ({ context, data }) => {
    if (!data?.id || typeof data.id !== "string" || data.id.length > 80) return null;
    return raceCard(await getSql(), context.userId, data.id);
  });

export const userMetrics = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => bookMetrics(await getSql(), context.userId));

export const userExport = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => exportBook(await getSql(), context.userId));

export const userFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { raceId: string }) => data)
  .handler(async ({ context, data }) => {
    if (!data?.raceId || typeof data.raceId !== "string" || data.raceId.length > 80) return { ok: false as const, reason: "Corrida em falta." };
    return toggleFavorite(await getSql(), context.userId, data.raceId);
  });

export const userPrediction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { raceId?: string; probabilities?: { runnerId: string; p: number }[]; pickRunnerId?: string | null }) => data)
  .handler(async ({ context, data }) => {
    if (!data?.raceId || typeof data.raceId !== "string" || !Array.isArray(data.probabilities)) {
      return { ok: false as const, reason: "Falta a corrida ou a distribuição." };
    }
    return recordPrediction(await getSql(), context.userId, {
      raceId: data.raceId,
      idempotencyKey: `user-stated:${data.raceId}`,
      modelId: "user-stated",
      modelVersion: "stated-1",
      parameters: { source: "user", note: "Distribuição informada pelo utilizador. Não é um modelo validado." },
      probabilities: data.probabilities,
      pickRunnerId: data.pickRunnerId ?? null,
    });
  });

export const userResult = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { raceId?: string; status?: string; runners?: { runnerId: string; position: number | null; nonRunner?: boolean }[] }) => data)
  .handler(async ({ context, data }) => {
    if (!data?.raceId || typeof data.raceId !== "string" || !data.status || !RESULT_STATUS.has(data.status) || !Array.isArray(data.runners)) {
      return { ok: false as const, reason: "Resultado incompleto." };
    }
    const runners = data.runners.filter(
      (runner) => runner && typeof runner.runnerId === "string" && (runner.position == null || (Number.isInteger(runner.position) && runner.position >= 1)),
    );
    if (runners.length !== data.runners.length) return { ok: false as const, reason: "Há um participante ou uma posição inválida." };
    const stamp = createHash("sha256")
      .update(
        runners
          .map((runner) => `${runner.runnerId}:${runner.nonRunner ? "nr" : runner.position ?? ""}`)
          .sort()
          .join("|"),
      )
      .digest("hex")
      .slice(0, 16);
    return recordResult(await getSql(), context.userId, {
      raceId: data.raceId,
      idempotencyKey: `user-${data.status}:${stamp}`,
      status: data.status,
      source: "user",
      payload: { runners, note: "Informado pelo utilizador. Sem verificação independente." },
    });
  });

export const sourceStatus = createServerFn({ method: "GET" }).handler(async () => providerState());
