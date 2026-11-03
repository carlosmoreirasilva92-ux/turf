import { createFileRoute } from "@tanstack/react-router";
import { AGENT_RULES, bestOfDay, raceForAgent, sourceDecision } from "@/lib/racing/agent-contract.ts";
import { fetchLiveBoard, fetchLiveRace } from "@/lib/racing/live-source.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

export const Route = createFileRoute("/api/agente/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const stakeRaw = new URL(request.url).searchParams.get("aposta");
        const stake = stakeRaw && /^\d{1,5}(\.\d{1,2})?$/.test(stakeRaw) ? Number(stakeRaw) : 10;
        const path = (params._splat ?? "").replace(/\/$/, "");
        if (path === "" || path === "fontes") {
          return json({
            name: "TURF",
            for: "agente Grok",
            how: AGENT_RULES,
            decision: sourceDecision(),
            read: {
              hoje: "/api/agente/hoje?aposta=10",
              corrida: "/api/agente/corrida/{id}?aposta=10",
              fontes: "/api/agente/fontes",
              texto: "/como",
            },
          });
        }
        if (path === "hoje") {
          const board = await fetchLiveBoard();
          if (!board.ok) return json({ ok: false, reason: board.reason, decision: sourceDecision() }, 502);
          const best = bestOfDay(board.value, stake);
          return json({
            ok: true,
            receivedAt: board.value.receivedAt,
            date: board.value.date,
            stake,
            decision: sourceDecision(),
            best,
            ifAllWin: {
              races: best.length,
              staked: Number((stake * best.length).toFixed(2)),
              profit: Number(best.reduce((sum, row) => sum + row.profitIfWins, 0).toFixed(2)),
              note: "Exige que todos vençam. Uma derrota tira essa aposta.",
            },
            races: board.value.races.map((race) => ({
              id: race.id,
              course: race.course,
              country: race.country,
              time: race.time,
              name: race.name,
              stage: race.stage,
              horse: race.shownName,
              fractional: race.shownFractional,
              decimal: race.shownDecimal,
            })),
          });
        }
        const raceMatch = path.match(/^corrida\/(\d{1,12})$/);
        if (raceMatch) {
          const race = await fetchLiveRace(raceMatch[1]!);
          if (!race.ok) return json({ ok: false, reason: race.reason, decision: sourceDecision() }, 502);
          return json({ ok: true, decision: sourceDecision(), race: raceForAgent(race.value, stake) });
        }
        return json({ ok: false, reason: "Caminho desconhecido. Começa em /api/agente/fontes." }, 404);
      },
    },
  },
});
