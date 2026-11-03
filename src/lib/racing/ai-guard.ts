export type AskTurn = { role: "user" | "assistant"; text: string };

export type AskInput = {
  question: string;
  raceId?: string;
  history: AskTurn[];
};

const ROLES = new Set(["user", "assistant"]);

export function parseAsk(value: unknown): { ok: true; value: AskInput } | { ok: false; error: string } {
  if (typeof value !== "object" || value === null) return { ok: false, error: "Pedido inválido." };
  const body = value as Record<string, unknown>;
  if (typeof body.question !== "string") return { ok: false, error: "A pergunta tem de ser texto." };
  const question = body.question.trim();
  if (question.length < 2 || question.length > 600) return { ok: false, error: "A pergunta tem de ter entre 2 e 600 caracteres." };
  if (body.raceId != null && (typeof body.raceId !== "string" || body.raceId.length > 80)) {
    return { ok: false, error: "Corrida inválida." };
  }
  const historyRaw = body.history ?? [];
  if (!Array.isArray(historyRaw) || historyRaw.length > 6) return { ok: false, error: "O histórico pode ter no máximo 6 voltas." };
  const history: AskTurn[] = [];
  for (const turn of historyRaw) {
    if (typeof turn !== "object" || turn === null) return { ok: false, error: "Volta inválida." };
    const row = turn as Record<string, unknown>;
    if (typeof row.role !== "string" || !ROLES.has(row.role) || typeof row.text !== "string" || row.text.length > 800) {
      return { ok: false, error: "Cada volta precisa de papel e texto até 800 caracteres." };
    }
    history.push({ role: row.role as AskTurn["role"], text: row.text });
  }
  return { ok: true, value: { question, raceId: typeof body.raceId === "string" ? body.raceId : undefined, history } };
}

export type QuotaLimits = { userHour: number; globalHour: number; userOpen: number };

export const DEFAULT_QUOTA: QuotaLimits = { userHour: 8, globalHour: 40, userOpen: 1 };

export function quotaDecision(
  usage: { userHour: number; globalHour: number; userOpen: number },
  limits: QuotaLimits = DEFAULT_QUOTA,
): { ok: true } | { ok: false; reason: "concurrency" | "user" | "global" } {
  if (usage.userOpen >= limits.userOpen) return { ok: false, reason: "concurrency" };
  if (usage.userHour >= limits.userHour) return { ok: false, reason: "user" };
  if (usage.globalHour >= limits.globalHour) return { ok: false, reason: "global" };
  return { ok: true };
}

export function clipAnswer(text: string, max = 1200): string {
  const clean = text.replace(/\*/g, "").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}
