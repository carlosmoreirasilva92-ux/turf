import { createFileRoute, Link } from "@tanstack/react-router";
import { DeskChat } from "@/components/desk-chat";
import { AGENTS, readsFor, recordOf } from "@/lib/racing/agents";
import { todayRaces } from "@/lib/racing/data";
import { fmtPct } from "@/lib/racing/format";

export const Route = createFileRoute("/agentes")({ component: Agentes });

function Agentes() {
  const focus =
    todayRaces.find((r) => r.status === "off" || r.status === "upcoming") ?? todayRaces[0];

  return (
    <div>
      <h1 className="font-display text-4xl tracking-tight">Agentes</h1>
      <p className="mt-2 text-sm text-muted">
        Cinco perspectivas por regras, versão actual, não cinco modelos. O acerto preservado só existe
        em snapshots gravados antes da largada; recalcular o exemplo com regras novas não é histórico.
        Não é conselho de aposta (18+).
      </p>
      {focus ? (
        <p className="mt-3 text-sm text-muted">
          Em foco agora: {focus.time} em {focus.course}.{" "}
          <Link to="/corrida/$id" params={{ id: focus.id }} className="text-accent">
            Ver a mesa nesta corrida
          </Link>
        </p>
      ) : null}

      <DeskChat raceId={focus?.id} />

      <div className="mt-6 space-y-3">
        {AGENTS.map((agent) => {
          const rec = recordOf(agent.id);
          const hit = rec.n ? rec.hits / rec.n : null;
          const agree = rec.n ? rec.agrees / rec.n : null;
          const today = focus ? readsFor(focus.id).find((r) => r.id === agent.id) : null;
          return (
            <article key={agent.id} className="glass px-4 py-4">
              <h2 className="font-display text-2xl tracking-tight">{agent.name}</h2>
              <p className="text-sm text-muted">{agent.role}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat k="Leituras" v={String(rec.n)} />
                <Stat k="Acerto" v={hit == null ? "—" : fmtPct(hit)} />
                <Stat k="Com o modelo" v={agree == null ? "—" : fmtPct(agree)} />
              </div>
              {focus && today ? (
                <p className="mt-3 text-sm text-muted">
                  <span className="text-subtle">
                    Hoje · {focus.time} {focus.course}.{" "}
                  </span>
                  {today.horse ?? "Abstém-se"}. {today.note}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-2xs tracking-wider text-subtle uppercase">{k}</p>
      <p className="mt-0.5 font-display text-xl tabular">{v}</p>
    </div>
  );
}
