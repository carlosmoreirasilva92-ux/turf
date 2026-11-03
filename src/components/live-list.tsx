import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Flag, Info, MapPin, RefreshCw, Shirt, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { liveBoard, liveDay } from "@/lib/racing/live-api";
import { stageLabel, type LiveDay, type LiveRaceSummary } from "@/lib/racing/live-card";
import type { LiveBoard, LiveBoardRace } from "@/lib/racing/live-source";
import { dublinClock } from "@/lib/racing/time";

const SCOPES = [
  { id: "IEGB", label: "Todas" },
  { id: "IE", label: "Irlanda" },
  { id: "GB", label: "Reino Unido" },
] as const;

function pct(decimal: number | null) {
  if (decimal == null || !(decimal > 1)) return null;
  return (100 / decimal).toFixed(1).replace(".", ",");
}

function pad(value: number) {
  return String(value).padStart(2, "0");
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

function euros(value: number) {
  return `€ ${value.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function HorseName({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? name;
  const rest = parts.slice(1).join(" ");
  return (
    <>
      {first}
      {rest ? <em className="font-normal text-[#b5d8c8]"> {rest}.</em> : <em className="text-[#b5d8c8]">.</em>}
    </>
  );
}

function RaceCard({ race, shown, stake }: { race: LiveRaceSummary; shown?: LiveBoardRace; stake: number }) {
  const implied = pct(shown?.shownDecimal ?? null);
  const width = shown?.shownDecimal && shown.shownDecimal > 1 ? Math.min(100, 100 / shown.shownDecimal) : 0;
  return (
    <li>
      <article className="overflow-hidden rounded-xl border border-white/8 bg-[#13191c] px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm">
              <span aria-hidden="true">{race.country === "IE" ? "🇮🇪" : race.country === "GB" ? "🇬🇧" : "🏳️"}</span>
              <span className="font-medium">{race.course}</span>
            </p>
            <p className="mt-1 text-[12px] text-[#9aa6a5]">
              {[race.discipline ?? "Tipo não indicado", race.distance, shown?.field != null ? `${shown.field} cavalos` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <p className="font-display text-[2rem] leading-none tabular">{race.time ?? "—"}</p>
        </div>
        <p className="mt-5 text-[10px] tracking-[0.16em] text-[#7c8a8b]">LÍDER DO PREÇO</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#0e1417] text-[#b5d8c8]" aria-hidden="true">
            <Shirt className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[1.65rem] leading-tight tracking-tight">
              {shown?.shownName ?? "A abrir o cavalo"}
            </span>
            <span className="block truncate text-xs text-[#9aa6a5]">
              {[shown?.shownJockey, shown?.shownForm].filter(Boolean).join(" · ") || stageLabel(race.stage)}
            </span>
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/8 py-3">
          <p>
            <span className="block text-[11px] text-[#7c8a8b]">No preço mostrado</span>
            <span className="font-display text-[1.7rem] tabular">{implied ? `${implied}%` : "—"}</span>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/8">
              <span className="block h-full bg-[#b5d8c8]" style={{ width: `${width}%` }} />
            </span>
          </p>
          <p>
            <span className="block text-[11px] text-[#7c8a8b]">Preço do cartão</span>
            <span className="font-display text-[1.7rem] tabular">{shown?.shownFractional ?? "—"}</span>
            <span className="block text-[11px] text-[#b1d9c3]">
              {shown?.shownDecimal && stake > 0 ? `Se vencer: +${euros(stake * (shown.shownDecimal - 1))}` : "Sem preço para a conta"}
            </span>
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-white/8 py-3">
          <span className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-[#9aa6a5]">Cartão público</span>
          <span className="flex items-center gap-3 text-sm text-[#b5d8c8]">
            <Star className="size-4" aria-hidden="true" />
            <Link to="/ao-vivo/$id" params={{ id: race.id }} className="inline-flex items-center gap-1">
              Analisar <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </span>
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
  const [stakeText, setStakeText] = useState("10");

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
  const heroPct = pct(heroShown?.shownDecimal ?? null);
  const stake = Number(stakeText.replace(",", "."));
  const stakeOk = Number.isFinite(stake) && stake > 0;
  const best = races
    .filter((race) => race.stage === "DORMANT" || race.stage === "OFF")
    .map((race) => ({ race, shown: prices.get(race.id) }))
    .filter((item) => item.shown?.shownName && item.shown.shownDecimal != null)
    .sort((a, b) => (a.shown?.shownDecimal ?? 99) - (b.shown?.shownDecimal ?? 99))
    .slice(0, 5);
  const allIn = stakeOk ? best.reduce((sum, item) => sum + stake * ((item.shown?.shownDecimal ?? 1) - 1), 0) : 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-[11px] tracking-[0.14em] text-[#9aa6a5] uppercase">
          <span className="size-1 rounded-full bg-[#b5d8c8]" aria-hidden="true" />
          {day ? dayLabel(day.date) : "Hoje · Dublin"}
        </p>
        <button type="button" className="inline-flex h-8 items-center gap-1.5 text-[12px] text-[#9aa6a5]" onClick={() => load(false)}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Atualizar
        </button>
      </div>

      {variant === "hoje" ? (
        <>
          <h1 className="mt-6 font-display text-[2.45rem] leading-[1.05] tracking-tight">Sua próxima boa leitura.</h1>
          <p className="mt-2 max-w-md text-[13px] text-[#9aa6a5]">O contexto antes da largada. A transparência depois dela.</p>
          <p className="mt-3 text-[12px] text-[#7c8a8b]" role="status">
            {loading ? "A ler o cartão público…" : error || (day ? `Atualizado às ${dublinClock(new Date(board?.receivedAt ?? day.receivedAt))}.` : "")}
          </p>
          <section className="mt-5" aria-label="Melhores cavalos do dia">
            <p className="text-[10px] tracking-[0.16em] text-[#7c8a8b]">PARA APOSTAR HOJE</p>
            <h2 className="font-display text-[2rem] leading-none tracking-tight">Os melhores do dia</h2>
            <p className="mt-2 text-[13px] text-[#9aa6a5]">
              Os 5 preços mais curtos que ainda não largaram. A percentagem é a conta desse preço. Se o cavalo vencer, o lucro é o da linha. Se não vencer, perdes a aposta.{" "}
              <Link to="/como" className="text-[#b5d8c8]">Como a mesa funciona</Link>
            </p>
            <div className="mt-4 flex items-center gap-2">
              <label className="text-[12px] text-[#9aa6a5]" htmlFor="aposta">
                Aposta
              </label>
              <input
                id="aposta"
                inputMode="decimal"
                value={stakeText}
                onChange={(event) => setStakeText(event.target.value)}
                className="h-11 w-24 rounded-md border border-white/10 bg-[#0e1417] px-3 text-right font-display text-2xl tabular outline-none"
                aria-label="Valor da aposta em euros"
              />
              <span className="text-sm text-[#9aa6a5]">€</span>
              {["10", "20", "50"].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={stakeText === value ? "h-9 rounded-md bg-[#b5d8c8] px-3 text-[12px] text-[#15271d]" : "h-9 rounded-md border border-white/10 px-3 text-[12px] text-[#9aa6a5]"}
                  onClick={() => setStakeText(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            {best.length === 0 ? (
              <p className="mt-4 text-sm text-[#9aa6a5]">{loading ? "A ordenar os preços…" : "Ainda não há preços para ordenar o dia."}</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {best.map((item, index) => {
                  const decimal = item.shown?.shownDecimal ?? 0;
                  const chance = pct(decimal);
                  const profit = stakeOk ? stake * (decimal - 1) : null;
                  const back = stakeOk ? stake * decimal : null;
                  return (
                    <li key={item.race.id}>
                      <Link to="/ao-vivo/$id" params={{ id: item.race.id }} className="block rounded-xl border border-white/8 bg-[#13191c] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[11px] tracking-[0.14em] text-[#b5d8c8]">
                            {index + 1}º · {chance}%
                          </p>
                          <p className="font-display text-2xl leading-none tabular">{item.race.time ?? "—"}</p>
                        </div>
                        <p className="mt-2 font-display text-[1.7rem] leading-tight tracking-tight">{item.shown?.shownName}</p>
                        <p className="text-[12px] text-[#9aa6a5]">
                          {item.race.course} · {item.shown?.shownFractional} · {item.shown?.shownJockey ?? "jóquei por indicar"}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <p className="rounded-md bg-[#0e1417] px-3 py-2">
                            <span className="block text-[11px] text-[#7c8a8b]">Recebes se vencer</span>
                            <span className="font-display text-2xl tabular">{back != null ? euros(back) : "—"}</span>
                          </p>
                          <p className="rounded-md bg-[#0e1417] px-3 py-2">
                            <span className="block text-[11px] text-[#7c8a8b]">Lucro se vencer</span>
                            <span className="font-display text-2xl text-[#b1d9c3] tabular">{profit != null ? `+${euros(profit)}` : "—"}</span>
                          </p>
                        </div>
                        <p className="mt-2 text-[12px] text-[#dfa2a8]">{stakeOk ? `Se não vencer: −${euros(stake)}` : "Indica um valor de aposta."}</p>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
            {best.length > 0 && stakeOk ? (
              <p className="mt-4 rounded-xl border border-[#b5d8c8]/20 bg-[#b5d8c8]/8 px-4 py-3 text-[13px]">
                Se apostares {euros(stake)} em cada um dos {best.length} e todos vencerem, o lucro soma {euros(allIn)}. São {best.length} corridas diferentes. Uma derrota tira essa aposta.
              </p>
            ) : null}
          </section>
          {hero ? (
            <section className="relative mt-5 overflow-hidden rounded-2xl border border-[#b5d8c8]/16 bg-[linear-gradient(115deg,#19261f,#131c19_55%,#131c1c)] px-5 py-6">
              <p className="flex items-center gap-2 text-[10px] tracking-[0.16em] text-[#8caa9b] uppercase">
                <span className="size-1 rounded-full bg-[#b5d8c8]" aria-hidden="true" />
                {stageLabel(hero.stage)} — próxima corrida
              </p>
              <h2 className="mt-4 font-display text-[3.15rem] leading-[0.95] tracking-tight">
                <HorseName name={heroShown?.shownName ?? hero.name} />
              </h2>
              <p className="mt-4 flex items-center gap-2 text-[13px] text-[#c5d2cb]">
                <MapPin className="size-3.5" aria-hidden="true" />
                {hero.course} · {hero.time ?? "hora por indicar"} · {hero.distance ?? "distância por indicar"}
              </p>
              <div className="mt-6 grid grid-cols-3">
                <p className="pr-2">
                  <span className="block text-[11px] text-[#8ea294]">No preço</span>
                  <span className="font-display text-[1.7rem] tabular">{heroPct ? `${heroPct}%` : "—"}</span>
                </p>
                <p className="border-l border-white/10 px-3">
                  <span className="block text-[11px] text-[#8ea294]">Preço</span>
                  <span className="font-display text-[1.7rem] tabular">{heroShown?.shownFractional ?? "—"}</span>
                </p>
                <p className="border-l border-white/10 pl-3">
                  <span className="block text-[11px] text-[#8ea294]">Forma</span>
                  <span className="font-display text-[1.35rem] tracking-tight">{heroShown?.shownForm ?? "—"}</span>
                </p>
              </div>
              <Link to="/ao-vivo/$id" params={{ id: hero.id }} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#b5d8c8] text-[13px] font-medium text-[#15271d]">
                Analisar corrida <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
              <p className="mt-3 text-[11px] text-[#8caa9b]">Cartão público · não é um modelo · não é o SP</p>
            </section>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <p className="rounded-xl border border-white/8 bg-[#13191c] px-4 py-4">
              <span className="flex items-center justify-between text-[12px] text-[#9aa6a5]">Corridas no programa <Flag className="size-4" aria-hidden="true" /></span>
              <span className="mt-2 block font-display text-[2.4rem] leading-none tabular">{races.length ? pad(races.length) : "—"}</span>
              <span className="mt-1 block text-[11px] text-[#7c8a8b]">Próximas largadas</span>
            </p>
            <p className="rounded-xl border border-white/8 bg-[#13191c] px-4 py-4">
              <span className="flex items-center justify-between text-[12px] text-[#9aa6a5]">Hipódromos <MapPin className="size-4" aria-hidden="true" /></span>
              <span className="mt-2 block font-display text-[2.4rem] leading-none tabular">{courses ? pad(courses) : "—"}</span>
              <span className="mt-1 block text-[11px] text-[#7c8a8b]">Na mesa de hoje</span>
            </p>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-6 font-display text-[2.45rem] leading-[1.05] tracking-tight">Cada corrida, em detalhe.</h1>
          <p className="mt-2 text-[13px] text-[#9aa6a5]">O programa, os participantes e o preço que o cartão mostra.</p>
          <p className="mt-3 flex gap-2 rounded-md border border-[#d8be87]/20 bg-[#d8be87]/6 px-3 py-2 text-[12px] text-[#9aa6a5]">
            <Info className="mt-0.5 size-4 shrink-0 text-[#d8be87]" aria-hidden="true" />
            Preços do cartão público. Não são de uma casa e não são o SP.
          </p>
          <input
            suppressHydrationWarning
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar hipódromo, cavalo ou jóquei"
            aria-label="Buscar hipódromo, cavalo ou jóquei"
            className="mt-4 h-12 w-full rounded-xl border border-white/10 bg-[#0e1417] px-4 text-base outline-none"
          />
          <p className="mt-3 text-[12px] text-[#7c8a8b]" role="status">{loading ? "A ler o cartão…" : error}</p>
        </>
      )}

      <div className="mt-6 flex items-end justify-between">
        <div>
          <p className="text-[10px] tracking-[0.16em] text-[#7c8a8b]">O PROGRAMA</p>
          <h2 className="font-display text-[2rem] leading-none tracking-tight">
            {variant === "hoje" ? "Próximas largadas" : "Programa"} <span className="text-[1rem] text-[#7c8a8b]">{pad(races.length)}</span>
          </h2>
        </div>
        {variant === "hoje" ? (
          <Link to="/corridas" className="text-[12px] text-[#b5d8c8]">Ver todas</Link>
        ) : null}
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto" role="group" aria-label="País">
        {SCOPES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={scope === item.id}
            className={
              scope === item.id
                ? "h-9 shrink-0 rounded-md border border-[#b5d8c8]/20 bg-[#b5d8c8]/10 px-3 text-[12px] text-[#b5d8c8]"
                : "h-9 shrink-0 rounded-md border border-white/10 px-3 text-[12px] text-[#9aa6a5]"
            }
            onClick={() => setScope(item.id)}
          >
            {item.id === "IE" ? "🇮🇪 " : item.id === "GB" ? "🇬🇧 " : ""}
            {item.label}
          </button>
        ))}
      </div>
      {!loading && races.length === 0 ? (
        <p className="mt-4 rounded-xl border border-white/8 px-4 py-8 text-center text-sm text-[#9aa6a5]">A fonte não publicou corridas para este filtro.</p>
      ) : null}
      <ul className="mt-3 space-y-3">
        {(variant === "hoje" ? races.slice(0, 6) : races).map((race) => (
          <RaceCard key={race.id} race={race} shown={prices.get(race.id)} stake={stakeOk ? stake : 0} />
        ))}
      </ul>
    </div>
  );
}
