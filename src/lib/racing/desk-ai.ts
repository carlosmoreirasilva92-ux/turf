import { createServerFn } from "@tanstack/react-start";
import { AGENTS, readsFor, recordOf } from "@/lib/racing/agents";
import { ledger, pickOf, raceById, type Race } from "@/lib/racing/data";
import { fmtOdd, fmtPct, fmtSignedPct } from "@/lib/racing/format";

export type DeskTurn = { role: "user" | "assistant"; text: string };

export type AskResult = { ok: boolean; answer: string };

const MODEL = "grok-4.5";

function raceBrief(race: Race) {
  const pick = pickOf(race);
  const field = [...race.horses]
    .sort((a, b) => b.modelP - a.modelP || a.cloth - b.cloth)
    .map((h) => {
      const place = h.position != null ? ` resultado ${h.position}º` : "";
      const rating = h.or != null ? ` OR ${h.or}` : "";
      return `${h.cloth}. ${h.name} | ${fmtPct(h.modelP)} | ${fmtOdd(h.odds)} | forma ${h.form} | ${h.weight}${rating} | ${h.jockey} / ${h.trainer}${place}`;
    })
    .join("\n");
  const gates = race.gates.map((g) => `${g.passed ? "passa" : "falha"} ${g.title}: ${g.why}`).join("\n");
  const mesa = readsFor(race.id)
    .map((r) => `${r.id}: ${r.horse ?? "abstem-se"} (${r.stance}). ${r.note}`)
    .join("\n");
  return [
    `Corrida ${race.id}`,
    `${race.date} ${race.time} ${race.course} (${race.country})`,
    `${race.name} · ${race.distance} · ${race.discipline} · ${race.going} · ${race.grade} · ${race.prize}`,
    `Estado ${race.status}. Qualificada: ${race.qualified ? "sim" : "não"}.`,
    `Modelo escolhe ${pick.name}. Valor ${race.value == null ? "sem cotação real" : fmtSignedPct(race.value)}.`,
    "Campo:",
    field,
    "Controlos:",
    gates,
    "Mesa:",
    mesa,
  ].join("\n");
}

function bookBrief() {
  const agents = AGENTS.map((a) => {
    const rec = recordOf(a.id);
    const hit = rec.n ? fmtPct(rec.hits / rec.n) : "—";
    return `${a.name}: ${rec.n} leituras, acerto ${hit}`;
  }).join("\n");
  return [
    `Caderno de demonstração, ancorado a 2 nov 2026 14:30, hora da Irlanda. Período ${ledger.periodLabel}.`,
    `${ledger.locked} leituras travadas, ${ledger.qualified} qualificadas, ${ledger.settled} liquidadas, ${ledger.awaiting} à espera.`,
    `Brier ${ledger.brier == null ? "—" : ledger.brier.toFixed(3)}. Log-loss ${ledger.logloss == null ? "—" : ledger.logloss.toFixed(3)}. Acerto do modelo ${ledger.hitRate == null ? "—" : fmtPct(ledger.hitRate)}.`,
    `ROI ${ledger.roi == null ? "—" : fmtSignedPct(ledger.roi)} em ${ledger.roiN}. CLV ${ledger.clv == null ? "—" : fmtSignedPct(ledger.clv)} em ${ledger.clvN}.`,
    agents,
  ].join("\n");
}

function cleanHistory(history: DeskTurn[] | undefined) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
    .slice(-6)
    .map((t) => ({ role: t.role, content: t.text.slice(0, 800) }));
}

export const askDesk = createServerFn({ method: "POST" })
  .validator((data: { question: string; raceId?: string; history?: DeskTurn[] }) => data)
  .handler(async ({ data }): Promise<AskResult> => {
    const question = String(data?.question ?? "").trim();
    if (question.length < 2 || question.length > 600) {
      return { ok: false, answer: "A pergunta tem de ter entre 2 e 600 caracteres." };
    }
    const key = process.env["XAI_API_KEY"]?.trim();
    if (!key) {
      return {
        ok: false,
        answer: "O agente de IA não está ligado neste servidor. A mesa de regras continua disponível.",
      };
    }
    const race = data.raceId ? raceById(String(data.raceId)) : null;
    const system = [
      "És o agente da mesa TURF, um caderno de corridas. Português europeu, frases curtas, texto corrido, sem markdown nem asteriscos.",
      "Não és conselho de aposta. Não inventas cotações, resultados, cavalos nem corridas que não estejam no contexto.",
      "Se pedirem uma aposta, recusas e dizes o que o cartão travado mostra.",
      "Se a corrida não estiver qualificada, diz SEM APOSTA e o controlo que falha.",
      "O cartão é uma demonstração, não um feed ao vivo.",
      bookBrief(),
      race ? raceBrief(race) : "Não há uma corrida escolhida. Responde só com o caderno.",
    ].join("\n\n");

    try {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env["XAI_MODEL"]?.trim() || MODEL,
          temperature: 0.3,
          max_tokens: 420,
          messages: [
            { role: "system", content: system },
            ...cleanHistory(data.history),
            { role: "user", content: question },
          ],
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) {
        return { ok: false, answer: "O agente não respondeu. Tenta outra vez daqui a pouco." };
      }
      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const answer = payload.choices?.[0]?.message?.content?.trim();
      if (!answer) return { ok: false, answer: "O agente ficou em silêncio. Tenta reformular." };
      return { ok: true, answer };
    } catch {
      return { ok: false, answer: "O agente não respondeu a tempo." };
    }
  });
