import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Silk } from "@/components/silk";
import { disciplinePt, pickOf, type Race } from "@/lib/racing/data";
import { fmtOdd, fmtPct } from "@/lib/racing/format";
import { cn } from "@/lib/utils";

export function Kpi({ k, v, tone }: { k: string; v: string; tone?: "win" | "loss" }) {
  return (
    <div className="glass px-3.5 py-3">
      <div className="text-2xs tracking-wider text-subtle uppercase">{k}</div>
      <div
        className={cn(
          "mt-1 font-display text-xl tracking-tight tabular",
          tone === "win" && "text-win",
          tone === "loss" && "text-loss",
          !tone && "text-fg",
        )}
      >
        {v}
      </div>
    </div>
  );
}

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xs tracking-[0.16em] text-subtle uppercase">{title}</h2>
      <p className="mt-1 text-sm text-muted">{note}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 shrink-0 rounded-full px-3.5 text-sm transition-colors duration-150",
        active ? "chip-holo" : "chip-glass hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function decisionLabel(race: Race) {
  if (race.origin === "synthetic") return "Exemplo";
  if (race.status === "off") return "A correr";
  if (race.status === "awaiting") return "À espera";
  if (race.status === "settled") return "Liquidada";
  return race.qualified ? "Qualificada" : "Sem aposta";
}

export function RaceRow({ race }: { race: Race }) {
  const pick = pickOf(race);
  const won = race.status === "settled" && pick.position === 1;
  const label = decisionLabel(race);
  const holo = race.qualified && (race.status === "upcoming" || race.status === "off");

  return (
    <Link
      to="/corrida/$id"
      params={{ id: race.id }}
      className="glass block px-4 py-3.5 transition-opacity duration-150 hover:opacity-95"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs tracking-[0.14em] text-subtle uppercase">
          {race.time} · {race.course}
          <span className="text-subtle"> · {race.country}</span>
        </p>
        <span
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-2xs tracking-wide uppercase",
            holo ? "chip-holo" : "chip-glass",
            won && "text-win",
          )}
        >
          {race.status === "off" ? <span className="live-dot" aria-hidden="true" /> : null}
          {label}
        </span>
      </div>
      <p className="mt-1.5 font-display text-lg leading-tight tracking-tight text-fg">{race.name}</p>
      <p className="mt-0.5 text-xs text-subtle">
        {race.distance} · {disciplinePt(race.discipline)} · {race.going} · {race.horses.length}{" "}
        cavalos
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Silk silk={pick.silk} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-fg">{pick.name}</p>
          <p className="truncate text-xs text-subtle">
            {pick.jockey} · {pick.trainer}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg tabular">{fmtPct(pick.modelP)}</p>
          <p className="text-xs text-subtle tabular">{fmtOdd(pick.odds)}</p>
        </div>
      </div>
      {race.status === "settled" ? (
        <p className={cn("mt-2 text-xs", won ? "text-win" : "text-subtle")}>
          {won
            ? `O escolhido venceu. SP ${fmtOdd(pick.sp)}.`
            : `Venceu ${race.horses.find((h) => h.position === 1)?.name ?? "—"}. O modelo apontava ${pick.name}.`}
        </p>
      ) : null}
    </Link>
  );
}
