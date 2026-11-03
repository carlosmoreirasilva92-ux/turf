import { CloudRain, Scale, ScrollText, Ticket, Warehouse } from "lucide-react";
import type { ReactNode } from "react";
import { Silk } from "@/components/silk";
import { AGENTS, readsFor, type AgentId, type AgentRead } from "@/lib/racing/agents";
import type { Race } from "@/lib/racing/data";
import { cn } from "@/lib/utils";

const ICONS: Record<AgentId, ReactNode> = {
  forma: <ScrollText className="size-4" />,
  pista: <CloudRain className="size-4" />,
  mercado: <Ticket className="size-4" />,
  estabulo: <Warehouse className="size-4" />,
  peso: <Scale className="size-4" />,
};

const STANCE = {
  alinha: "Alinha",
  discorda: "Discorda",
  abstem: "Abstém-se",
} as const;

export function AgentDesk({ race }: { race: Race }) {
  const reads = readsFor(race.id);

  return (
    <section className="mt-8" aria-labelledby="mesa-agentes">
      <h2 id="mesa-agentes" className="text-xs tracking-[0.16em] text-subtle uppercase">
        Mesa de perspectivas
      </h2>
      <p className="mt-1 text-sm text-muted">
        Regras sobre este exemplo. Sem hora de observação, histórico de pista ou estábulo, a regra abstém-se em vez de inventar um cavalo. Concordar não aumenta a probabilidade.
      </p>
      <ul className="mt-3 space-y-2">
        {reads.map((read) => (
          <AgentRow key={read.id} race={race} read={read} />
        ))}
      </ul>
    </section>
  );
}

function AgentRow({ race, read }: { race: Race; read: AgentRead }) {
  const meta = AGENTS.find((a) => a.id === read.id)!;
  const horse = read.horse ? race.horses.find((h) => h.name === read.horse) : null;
  return (
    <li className="glass flex items-start gap-3 px-3 py-3">
      <span className={cn("icon-circle mt-0.5 size-8 shrink-0", read.stance === "alinha" && "green")}>
        {ICONS[read.id]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-base tracking-tight text-fg">{meta.name}</p>
          <span
            className={cn(
              "shrink-0 text-2xs tracking-wide uppercase",
              read.stance === "alinha" && "text-win",
              read.stance === "discorda" && "text-loss",
              read.stance === "abstem" && "text-subtle",
            )}
          >
            {STANCE[read.stance]}
          </span>
        </div>
        <p className="text-xs text-subtle">{meta.role}</p>
        <p className="mt-1 text-sm text-muted">{read.note}</p>
      </div>
      {horse ? <Silk silk={horse.silk} size={36} /> : null}
    </li>
  );
}
