import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { CATALOG } from "./catalog.ts";
import {
  archiveRace,
  coverageReport,
  horseProfile,
  importHistory,
  listArchive,
  listEntities,
  personProfile,
  runCycle,
  trainExperimental,
} from "./store.ts";

const KINDS = new Set(["horse", "jockey", "trainer", "owner", "stable"]);

export const importHistoryCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { body?: unknown; importKey?: string }) => data)
  .handler(async ({ context, data }) => {
    const importKey = typeof data?.importKey === "string" ? data.importKey.trim() : "";
    if (!importKey || data?.body == null) return { ok: false as const, errors: [{ path: "body", message: "Falta o pacote ou a chave." }] };
    return importHistory(await getSql(), context.userId, data.body, importKey);
  });

export const listSubjects = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { kind?: string; q?: string; offset?: number }) => data ?? {})
  .handler(async ({ context, data }) => {
    const kind = KINDS.has(data?.kind ?? "") ? data!.kind! : "horse";
    const q = typeof data?.q === "string" ? data.q.slice(0, 80) : "";
    return listEntities(await getSql(), context.userId, { kind, q, offset: Number(data?.offset) || 0 });
  });

export const horseCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id?: string }) => data)
  .handler(async ({ context, data }) => {
    if (!data?.id || typeof data.id !== "string") return null;
    return horseProfile(await getSql(), context.userId, data.id);
  });

export const personCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id?: string }) => data)
  .handler(async ({ context, data }) => {
    if (!data?.id || typeof data.id !== "string") return null;
    return personProfile(await getSql(), context.userId, data.id);
  });

export const archiveList = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { q?: string; country?: string; going?: string; offset?: number }) => data ?? {})
  .handler(async ({ context, data }) =>
    listArchive(await getSql(), context.userId, {
      q: data?.q?.slice(0, 80) ?? "",
      country: data?.country?.slice(0, 40) ?? "",
      going: data?.going?.slice(0, 40) ?? "",
      offset: Number(data?.offset) || 0,
    }),
  );

export const archiveCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id?: string }) => data)
  .handler(async ({ context, data }) => {
    if (!data?.id) return null;
    return archiveRace(await getSql(), context.userId, data.id);
  });

export const historyCoverage = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => coverageReport(await getSql(), context.userId));

export const historyCycle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { raceId?: string }) => data)
  .handler(async ({ context, data }) => {
    if (!data?.raceId) return { ok: false as const, reason: "Indique a corrida." };
    return runCycle(await getSql(), context.userId, data.raceId);
  });

export const historyTrain = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => trainExperimental(await getSql(), context.userId));

export const catalogSlice = createServerFn({ method: "GET" }).handler(async () => ({
  version: "catalog-1",
  total: CATALOG.length,
  note: "O catálogo descreve o que pode ser guardado. O banco começa vazio. Preenchimento depende de importação.",
}));
