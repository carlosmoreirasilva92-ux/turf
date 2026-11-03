import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, X } from "lucide-react";
import { useState } from "react";
import { AgentDesk } from "@/components/agent-desk";
import { Chip } from "@/components/racing-ui";
import { Silk } from "@/components/silk";
import { disciplinePt, pickOf, raceById, type Horse } from "@/lib/racing/data";
import { fmtDayLabel, fmtOdd, fmtPct, fmtSignedPct } from "@/lib/racing/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/corrida/$id")({ component: RacePage });

type Order = "model" | "cloth" | "result";

function RacePage() {
  const { id } = Route.useParams();
  const race = raceById(id);
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order>("model");

  if (!race) {
    return (
      <div>
        <h1 className="font-display text-3xl tracking-tight">Corrida em falta</h1>
        <p className="mt-2 text-sm text-muted">Esta leitura não está no universo do caderno.</p>
        <Link to="/corridas" className="chip-glass mt-4 inline-flex h-11 items-center rounded-full px-4 text-sm">
          Ver corridas
        </Link>
      </div>
    );
  }

  const pick = pickOf(race);
  const horses = [...race.horses].sort((a, b) => {
    if (order === "cloth") return a.cloth - b.cloth;
    if (order === "result") {
      if (a.position == null && b.position == null) return a.cloth - b.cloth;
      if (a.position == null) return 1;
      if (b.position == null) return -1;
      return a.position - b.position;
    }
    return b.modelP - a.modelP || a.cloth - b.cloth;
  });
  const winner = race.horses.find((h) => h.position === 1);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) window.history.back();
          else void navigate({ to: "/" });
        }}
        className="chip-glass inline-flex h-11 items-center gap-1 rounded-full pr-4 pl-2 text-sm"
      >
        <ChevronLeft className="size-4" />
        Voltar
      </button>

      <p className="mt-4 text-xs tracking-[0.16em] text-subtle uppercase">
        {fmtDayLabel(race.date)} · {race.time} · {race.country}
      </p>
      <h1 className="mt-1 font-display text-3xl tracking-tight">{race.course}</h1>
      <p className="mt-1 font-display text-xl text-muted">{race.name}</p>
      <p className="mt-2 text-sm text-muted">
        {race.distance} · {disciplinePt(race.discipline)} · {race.going} · {race.grade} · {race.prize}{" "}
        · {race.horses.length} cavalos
      </p>

      <div
        className={cn(
          "mt-4 rounded-[1.25rem] px-4 py-3 text-sm",
          race.qualified ? "chip-holo" : "chip-glass",
        )}
      >
        {race.qualified ? "QUALIFICADA" : "SEM APOSTA"}
        <span className="mt-1 block text-xs opacity-80">
          Escolhido: {pick.name}
          {race.value != null ? ` · valor ${fmtSignedPct(race.value)}` : " · sem cotação real"}
          {race.status === "settled" && winner
            ? pick.position === 1
              ? " · o escolhido venceu"
              : ` · venceu ${winner.name}`
            : race.status === "off"
              ? " · a correr"
              : race.status === "awaiting"
                ? " · resultado ainda não oficial"
                : ""}
        </span>
      </div>

      <AgentDesk race={race} />

      <h2 className="mt-8 text-xs tracking-[0.16em] text-subtle uppercase">Controlos</h2>
      <ul className="glass mt-2 divide-y divide-line">
        {race.gates.map((gate) => (
          <li key={gate.code} className="flex items-start gap-3 px-3 py-3">
            <span className={cn("icon-circle mt-0.5 size-6 shrink-0", gate.passed ? "green" : "red")}>
              {gate.passed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-fg">{gate.title}</p>
              <p className="text-xs text-muted">{gate.why}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs tracking-[0.16em] text-subtle uppercase">Campo</h2>
        <div className="flex gap-1">
          <Chip active={order === "model"} onClick={() => setOrder("model")}>
            Modelo
          </Chip>
          <Chip active={order === "cloth"} onClick={() => setOrder("cloth")}>
            Partida
          </Chip>
          {race.status === "settled" ? (
            <Chip active={order === "result"} onClick={() => setOrder("result")}>
              Resultado
            </Chip>
          ) : null}
        </div>
      </div>

      <ol className="mt-3 space-y-2">
        {horses.map((horse) => (
          <HorseRow key={horse.cloth} horse={horse} pick={horse.name === pick.name} settled={race.status === "settled"} />
        ))}
      </ol>
    </div>
  );
}

function HorseRow({ horse, pick, settled }: { horse: Horse; pick: boolean; settled: boolean }) {
  return (
    <li className={cn("glass flex items-center gap-3 px-3 py-3", pick && "row-pick")}>
      <span className="w-6 shrink-0 text-center font-display text-sm text-subtle tabular">
        {horse.cloth}
      </span>
      <Silk silk={horse.silk} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-fg">
          {horse.name}
          {pick ? <span className="ml-2 text-2xs tracking-wide text-accent uppercase">escolhido</span> : null}
        </p>
        <p className="truncate text-xs text-subtle">
          {horse.jockey} · {horse.trainer}
        </p>
        <p className="text-xs text-subtle tabular">
          {horse.age} anos · {horse.weight}
          {horse.or != null ? ` · OR ${horse.or}` : ""} · {horse.form}
        </p>
      </div>
      <div className="text-right">
        {settled && horse.position != null ? (
          <p className={cn("font-display text-sm tabular", horse.position === 1 ? "text-win" : "text-subtle")}>
            {horse.position}º
          </p>
        ) : null}
        <p className="font-display text-lg tabular">{fmtPct(horse.modelP)}</p>
        <p className="text-xs text-subtle tabular">
          {fmtOdd(horse.odds)}
          {settled ? ` · SP ${fmtOdd(horse.sp)}` : ""}
        </p>
      </div>
    </li>
  );
}
