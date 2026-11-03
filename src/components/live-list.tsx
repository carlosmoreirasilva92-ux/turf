import { Link } from "@tanstack/react-router";
import { RefreshCw, Shirt } from "lucide-react";
import { useEffect, useState } from "react";
import { liveBoard, liveDay } from "@/lib/racing/live-api";
import { stageLabel, type LiveDay, type LiveRaceSummary } from "@/lib/racing/live-card";
import type { LiveBoard, LiveBoardRace } from "@/lib/racing/live-source";
import { formatDublin } from "@/lib/racing/time";

const SCOPES = [
  { id: "IEGB", label: "Todas" },
  { id: "IE", label: "Irlanda" },
  { id: "GB", label: "Reino Unido" },
] as const;

function pct(decimal: number | null) {
  if (decimal == null || !(decimal > 1)) return null;
  return (100 / decimal).toFixed(1).replace(".", ",");
}

function flag(country: string) {
  if (country === "IE") return "Irlanda";
  if (country === "GB") return "Reino Unido";
  return country;
}

function dayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function RaceCard({ race, shown }: { race: LiveRaceSummary; shown?: LiveBoardRace }) {
  const implied = pct(shown?.shownDecimal ?? null);
  return (
    <li>
      <article className="panel px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm">
            <span className="font-medium">{race.course}</span>
            <span className="text-subtle"> · {flag(race.country)}</span>
          </p>
          <p className="font-display text-3xl tabular">{race.time ?? "—"}</p>
        </div>
        <p className="mt-1 text-sm text-muted">
          {[race.discipline ?? "Tipo não indicado", race.distance, race.going, shown?.field != null ? `${shown.field} cavalos` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-4 text-2xs tracking-[0.16em] text-subtle uppercase">Preço mais curto do cartão</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-white/6" aria-hidden="true">
            <Shirt className="size-5 text-[#d7efe4]" />
          </span>
          <span>
            <span className="block font-display text-2xl tracking-tight">{shown?.shownName ?? "A abrir o cavalo…"}</span>
            <span className="block text-xs text-subtle">
              {[shown?.shownJockey, shown?.shownTrainer].filter(Boolean).join(" · ") || stageLabel(race.stage)}
            </span>
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/8 pt-3">
          <p>
            <span className="block text-xs text-subtle">No preço mostrado</span>
            <span className="font-display text-3xl tabular">{implied ? `${implied}%` : "—"}</span>
          </p>
          <p>
            <span className="block text-xs text-subtle">Preço do cartão</span>
            <span className="font-display text-3xl tabular">{shown?.shownFractional ?? "—"}</span>
            <span className="block text-xs text-subtle">Não é o SP</span>
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-subtle">Cartão público</span>
          <Link to="/ao-vivo/$id" params={{ id: race.id }} className="text-sm text-[#d7efe4]">
            Analisar
          </Link>
        </div>
      </article>
    </li>
  );
}

export function LiveList({ variant }: { variant: "hoje" | "lista" }) {
  const [day, setDay] = useState<LiveDay | null>(null);
  const [board, setBoard] = useState<LiveBoard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<(typeof SCOPES)[number]["id"]>("IEGB");
  const [q, setQ] = useState("");

  function load(first: boolean) {
    if (first) setLoading(true);
    void liveDay()
      .then((result) => {
        if (!result.ok) {
          if (first) setDay(null);
          setError(result.reason);
          return;
        }
        setError("");
        setDay(result.value);
      })
      .catch(() => {
        if (first) setDay(null);
        setError("O cartão público não respondeu. A demonstração não foi usada no lugar.");
      })
      .finally(() => setLoading(false));
    void liveBoard()
      .then((result) => {
        if (result.ok) setBoard(result.value);
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    load(true);
    const timer = window.setInterval(() => load(false), 45_000);
    return () => window.clearInterval(timer);
  }, []);

  const prices = new Map(board?.races.map((race) => [race.id, race]) ?? []);
  const needle = q.trim().toLowerCase();
  const races = (day?.meetings ?? [])
    .flatMap((meeting) => meeting.races.map((race) => ({ ...race, going: race.going || meeting.going })))
    .filter((race) => {
      const place = scope === "IE" ? race.country === "IE" : scope === "GB" ? race.country === "GB" : race.country === "IE" || race.country === "GB";
      if (!place) return false;
      const shown = prices.get(race.id);
      const blob = `${race.course} ${race.name} ${shown?.shownName ?? ""} ${shown?.shownJockey ?? ""}`.toLowerCase();
      return !needle || blob.includes(needle);
    })
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.course.localeCompare(b.course, "pt"));
  const hero = races[0];
  const heroShown = hero ? prices.get(hero.id) : undefined;
  const courses = new Set(races.map((race) => race.course)).size;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs tracking-[0.14em] text-subtle uppercase">
          <span className="mr-2 inline-block size-1.5 rounded-full bg-[#7dcea0]" aria-hidden="true" />
          {day ? dayLabel(day.date) : "Hoje · Dublin"}
        </p>
        <button type="button" className="inline-flex h-11 items-center gap-2 text-sm text-muted" onClick={() => load(false)}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Atualizar
        </button>
      </div>
      <p className="mt-3 text-sm text-muted" role="status">
        {loading ? "A ler o cartão público…" : null}
        {!loading && error ? error : null}
        {!loading && day ? `Lido às ${formatDublin(board?.receivedAt ?? day.receivedAt)}.` : null}
      </p>

      {variant === "hoje" ? (
        <>
          <h1 className="mt-6 font-display text-5xl tracking-tight">A próxima corrida real.</h1>
          <p className="mt-2 text-sm text-muted">O preço mais curto do cartão público. Não é um modelo e não é o SP.</p>
          {hero ? (
            <section className="hero-card mt-6 px-5 py-6">
              <p className="text-xs tracking-[0.16em] text-[#d7efe4] uppercase">{stageLabel(hero.stage)} · próxima corrida</p>
              <h2 className="mt-3 font-display text-5xl leading-none tracking-tight">{heroShown?.shownName ?? hero.name}</h2>
              <p className="mt-4 text-sm text-muted">
                {hero.course} · {hero.time ?? "hora por indicar"} · {hero.distance ?? "distância por indicar"}
              </p>
              <div className="mt-6 grid grid-cols-3 gap-2">
                <p>
                  <span className="block text-xs text-subtle">No preço</span>
                  <span className="font-display text-3xl tabular">{pct(heroShown?.shownDecimal ?? null) ? `${pct(heroShown?.shownDecimal ?? null)}%` : "—"}</span>
                </p>
                <p>
                  <span className="block text-xs text-subtle">Preço</span>
                  <span className="font-display text-3xl tabular">{heroShown?.shownFractional ?? "—"}</span>
                </p>
                <p>
                  <span className="block text-xs text-subtle">Cavalos</span>
                  <span className="font-display text-3xl tabular">{heroShown?.field ?? hero.runnersDeclared ?? "—"}</span>
                </p>
              </div>
              <Link to="/ao-vivo/$id" params={{ id: hero.id }} className="btn-mint mt-6 w-full">
                Analisar corrida
              </Link>
              <p className="mt-3 text-xs text-subtle">Cartão público · não calibrado · não é seleção</p>
            </section>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <p className="panel px-4 py-4">
              <span className="block text-xs text-subtle">Corridas no programa</span>
              <span className="font-display text-4xl tabular">{races.length || "—"}</span>
            </p>
            <p className="panel px-4 py-4">
              <span className="block text-xs text-subtle">Hipódromos</span>
              <span className="font-display text-4xl tabular">{courses || "—"}</span>
            </p>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-6 font-display text-5xl tracking-tight">Cada corrida, em detalhe.</h1>
          <p className="mt-2 text-sm text-muted">O programa de hoje na Irlanda e no Reino Unido.</p>
          <input
            suppressHydrationWarning
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar hipódromo, cavalo ou jóquei"
            aria-label="Buscar hipódromo, cavalo ou jóquei"
            className="input-glass mt-5 h-12 w-full px-4 text-base"
          />
        </>
      )}

      <div className="mt-5 flex gap-2 overflow-x-auto" role="group" aria-label="País">
        {SCOPES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={scope === item.id}
            className={scope === item.id ? "chip-holo h-11 shrink-0 rounded-full px-4 text-sm" : "chip-glass h-11 shrink-0 rounded-full px-4 text-sm"}
            onClick={() => setScope(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-end justify-between">
        <h2 className="font-display text-3xl tracking-tight">{variant === "hoje" ? "Próximas largadas" : "Programa"}</h2>
        <span className="text-sm text-subtle tabular">{races.length}</span>
      </div>
      {!loading && races.length === 0 ? <p className="panel mt-4 px-4 py-8 text-center text-sm text-muted">A fonte não publicou corridas para este filtro.</p> : null}
      <ul className="mt-3 space-y-3">
        {(variant === "hoje" ? races.slice(0, 6) : races).map((race) => (
          <RaceCard key={race.id} race={race} shown={prices.get(race.id)} />
        ))}
      </ul>
      {variant === "hoje" && races.length > 6 ? (
        <Link to="/corridas" className="mt-4 inline-flex h-11 items-center text-sm text-[#d7efe4]">
          Ver todas
        </Link>
      ) : null}
    </div>
  );
}
