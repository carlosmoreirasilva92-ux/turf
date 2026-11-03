import { contentHash } from "./hash.ts";
import { qualificationAllowed, type ModelValidation } from "./qualify.ts";
import type { PerspectiveRead } from "./perspectives.ts";

export type SnapshotBody = {
  raceId: string;
  offAt: string;
  serverNow: string;
  modelId: string;
  modelVersion: string;
  parameters: Record<string, unknown>;
  runners: { runnerId: string; p: number }[];
  pickRunnerId: string | null;
  prices: { runnerId: string; priceId: string; book: string; decimal: number; observedAt: string | null }[];
  perspectives: PerspectiveRead[];
  perspectiveVersion: string;
  validation: ModelValidation;
  qualified: boolean;
};

export function planRecording(input: { serverNow: string; offAt: string }): { ok: true } | { ok: false; reason: string } {
  const now = Date.parse(input.serverNow);
  const off = Date.parse(input.offAt);
  if (Number.isNaN(now) || Number.isNaN(off)) return { ok: false, reason: "instante inválido" };
  if (now >= off) return { ok: false, reason: "a largada já passou; o registo retroactivo é recusado" };
  return { ok: true };
}

export function checkDistribution(
  runnerIds: string[],
  rows: { runnerId: string; p: number }[],
): { ok: true } | { ok: false; reason: string } {
  if (runnerIds.length === 0) return { ok: false, reason: "corrida sem participantes" };
  const ids = new Set(rows.map((row) => row.runnerId));
  if (ids.size !== rows.length || runnerIds.some((id) => !ids.has(id)) || rows.length !== runnerIds.length) {
    return { ok: false, reason: "a distribuição tem de cobrir cada participante uma vez" };
  }
  if (rows.some((row) => !Number.isFinite(row.p) || row.p < 0)) return { ok: false, reason: "probabilidade inválida" };
  const sum = rows.reduce((acc, row) => acc + row.p, 0);
  if (Math.abs(sum - 1) > 0.01) return { ok: false, reason: "as probabilidades não somam 1" };
  return { ok: true };
}

export function buildSnapshot(body: Omit<SnapshotBody, "qualified"> & { validation: ModelValidation }): SnapshotBody & { hash: string } {
  const qualified = qualificationAllowed(body.validation);
  const snapshot: SnapshotBody = { ...body, qualified };
  return { ...snapshot, hash: contentHash(snapshot) };
}

export function sameWrite(
  existing: { idempotencyKey: string; hash: string } | null,
  incoming: { idempotencyKey: string; hash: string },
): "insert" | "replay" | "conflict" {
  if (!existing) return "insert";
  if (existing.idempotencyKey === incoming.idempotencyKey && existing.hash === incoming.hash) return "replay";
  return "conflict";
}
