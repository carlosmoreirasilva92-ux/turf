import { createFileRoute, Link } from "@tanstack/react-router";
import { Shirt } from "lucide-react";
import { useEffect, useState } from "react";
import { importUserCard } from "@/lib/racing/api";
import { betfairOverlay, liveRace } from "@/lib/racing/live-api";
import { horseKey, type BetfairView } from "@/lib/racing/betfair-join";
import { LIVE_BOOK, stageLabel, type LiveRace } from "@/lib/racing/live-card";
import { formatDublin } from "@/lib/racing/time";

export const Route = createFileRoute("/ao-vivo/$id")({ component: Ficha });

function Ficha() {
  const { id } = Route.useParams();
  const [race, setRace] = useState<LiveRace | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [order, setOrder] = useState<"preco" | "numero">("preco");
  const [stakeText, setStakeText] = useState("10");
  const [exchange, setExchange] = useState<BetfairView | null>(null);

  useEffect(() => {
    let stop = false;
    function load() {
      void liveRace({ data: { id } })
        .then((result) => {
          if (stop) return;
          if (!result.ok) setError(result.reason);
          else {
            setError("");
            setRace(result.value);
          }
        })
        .catch(() => {
          if (!stop) setError("A ficha pública não respondeu. Nada foi inventado.");
        });
      void betfairOverlay()
        .then((result) => {
          if (!stop) setExchange(result);
        })
        .catch(() => {
          if (!stop) setExchange({ ok: false, reason: "A Betfair Exchange não respondeu. O cartão público mantém-se." });
        });
    }
    setRace(null);
    setError("");
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [id]);

  function save() {
    if (!race?.offAt || !race.discipline || race.country === "—") {
      setNote("Não gravei. Falta a hora, o país ou o tipo no nome (Chase, Hurdle, Flat ou Bumper). Não invento esses campos.");
      return;
    }
    const body = {
      races: [
        {
          providerRaceId: `sl-${race.id}`,
          course: race.course,
          country: race.country,
          discipline: race.discipline,
          name: race.name,
          distance: race.distance,
          going: race.going,
          offAt: race.offAt,
          handicap: race.handicap,
          runners: race.runners.map((runner) => ({
            name: runner.name,
            horseKey: runner.id,
            providerRunnerId: runner.id,
            cloth: runner.cloth,
            jockey: runner.jockey,
            trainer: runner.trainer,
            form: runner.form,
            weightLb: runner.weightLb,
            or: runner.or,
            goingRuns: runner.goingRuns,
          })),
          prices: race.runners
            .filter((runner) => runner.decimal != null)
            .map((runner) => ({
              runnerKey: runner.id,
              market: "WIN" as const,
              book: LIVE_BOOK,
              decimal: runner.decimal,
              observedAt: race.receivedAt,
            })),
        },
      ],
    };
    void importUserCard({ data: { body, importKey: `sl-${race.id}-${race.receivedAt}` } })
      .then((result) => {
        if (!result.ok) setNote(result.errors.map((issue) => issue.message).join(" "));
        else setNote(result.replay ? "Esta leitura já estava no livro." : "Cópia gravada no livro, marcada como tua. Não é SP nem foi verificada.");
      })
      .catch(() => setNote("Sem sessão, nada foi gravado."));
  }

  if (error) {
    return (
      <div>
        <h1 className="font-display text-3xl">Ficha em falta</h1>
        <p className="mt-2 text-sm text-muted" role="alert">{error}</p>
        <Link to="/" className="chip-glass mt-4 inline-flex h-11 items-center rounded-full px-4 text-sm">
          Voltar ao cartão
        </Link>
      </div>
    );
  }
  if (!race) return <p className="text-sm text-muted" role="status">A ler a ficha pública…</p>;
  const stake = Number(stakeText.replace(",", "."));
  const stakeOk = Number.isFinite(stake) && stake > 0;
  const runners = race.runners.slice().sort((a, b) => {
    if (order === "numero") return (a.cloth ?? 99) - (b.cloth ?? 99);
    const ap = a.decimal ?? 999;
    const bp = b.decimal ?? 999;
    return ap - bp || (a.cloth ?? 99) - (b.cloth ?? 99);
  });
  const leader = runners.find((runner) => runner.decimal != null && runner.status !== "NON_RUNNER");
  const chance = (decimal: number | null) => (decimal != null && decimal > 1 ? `${(100 / decimal).toFixed(1).replace(".", ",")}%` : "—");
  const euros = (value: number) => `€ ${value.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const kg = (lb: number) => `${(lb * 0.45359237).toFixed(1).replace(".", ",")} kg`;
  const quoteOf = (name: string) => (exchange?.ok ? exchange.quotes[race.id]?.[horseKey(name)] : undefined);
  const leaderQuote = leader ? quoteOf(leader.name) : undefined;

  return (
    <div>
      <p className="text-[11px] tracking-[0.16em] text-[#7c8a8b] uppercase">A ficha da corrida</p>
      <div className="mt-3 flex items-start justify-between gap-3">
        <p className="text-sm">{race.course} · {race.country}</p>
        <p className="font-display text-4xl leading-none tabular">{race.time ?? "—"}</p>
      </div>
      <h1 className="mt-2 font-display text-[2.6rem] leading-none tracking-tight">{race.name}</h1>
      <p className="mt-3 text-[13px] text-[#9aa6a5]">
        {[race.distance, race.going || "Terreno não indicado", race.discipline ?? "Tipo não indicado", stageLabel(race.stage)].join(" · ")}
      </p>
      <p className="mt-2 text-[12px] text-[#9aa6a5]" role="status">
        {exchange?.ok ? `${exchange.notice} Atualizado às ${formatDublin(exchange.receivedAt)}.` : exchange?.reason || "A ler a Betfair Exchange…"}
      </p>
      {leader ? (
        <section className="mt-4 rounded-2xl border border-white/8 bg-[#13191c] px-4 py-5">
          <p className="text-center text-[10px] tracking-[0.16em] text-[#7c8a8b]">PREÇO MAIS CURTO DO CARTÃO</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[#0e1417] text-[#b5d8c8]" aria-hidden="true">
              <Shirt className="size-6" />
            </span>
            <span>
              <span className="block font-display text-[1.8rem] leading-tight tracking-tight">{leader.name}</span>
              <span className="block text-[13px] text-[#9aa6a5]">{[leader.jockey, leader.trainer].filter(Boolean).join(" · ") || "Ligações não indicadas"}</span>
            </span>
          </div>
          <div className="mt-5 grid grid-cols-3">
            <p>
              <span className="block text-[11px] text-[#7c8a8b]">No preço</span>
              <span className="font-display text-[1.8rem] tabular">{chance(leader.decimal)}</span>
            </p>
            <p className="border-l border-white/10 px-3">
              <span className="block text-[11px] text-[#7c8a8b]">Decimal</span>
              <span className="font-display text-[1.8rem] tabular">{leader.decimal?.toFixed(2).replace(".", ",")}</span>
            </p>
            <p className="border-l border-white/10 pl-3">
              <span className="block text-[11px] text-[#7c8a8b]">No cartão</span>
              <span className="font-display text-[1.8rem] tabular">{leader.fractional}</span>
            </p>
          </div>
          <p className="mt-4 text-[13px] text-[#d7efe4]">
            {leaderQuote ? `Back ${leaderQuote.back.toFixed(2).replace(".", ",")} · ${String(leaderQuote.percent).replace(".", ",")}%` : "Back da Betfair por indicar"}
            {leaderQuote?.valor ? <span className="ml-2 rounded-md bg-[#b5d8c8] px-2 py-0.5 text-[11px] text-[#15271d]">Valor</span> : null}
          </p>
          <p className="mt-3 flex gap-2 text-[12px] text-[#9aa6a5]">
            <span aria-hidden="true">ⓘ</span>
            Esta percentagem é só o preço publicado. O Back é a Betfair Exchange, com atraso. Não é um modelo.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <label htmlFor="aposta-ficha" className="text-[12px] text-[#9aa6a5]">Se apostares</label>
            <input id="aposta-ficha" inputMode="decimal" value={stakeText} onChange={(event) => setStakeText(event.target.value)} className="h-10 w-20 rounded-md border border-white/10 bg-[#0e1417] px-2 text-right tabular outline-none" />
            <span className="text-[12px] text-[#9aa6a5]">€</span>
          </div>
          {stakeOk && leader.decimal ? (
            <p className="mt-3 text-[13px]">
              Se vencer, recebes {euros(stake * leader.decimal)} e o lucro é <span className="text-[#b1d9c3]">+{euros(stake * (leader.decimal - 1))}</span>. Se não vencer, perdes {euros(stake)}.
            </p>
          ) : null}
        </section>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/corridas" className="inline-flex h-10 items-center rounded-md border border-white/10 px-3 text-[13px]">Programa</Link>
        <button type="button" className="inline-flex h-10 items-center rounded-md bg-[#b5d8c8] px-3 text-[13px] font-medium text-[#15271d]" onClick={save}>Travar cópia no livro</button>
      </div>
      {note ? <p className="mt-3 text-sm text-[#9aa6a5]" role="status">{note}</p> : null}
      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="font-display text-[1.7rem]">Participantes</h2>
        <button type="button" className="h-9 rounded-md border border-white/10 px-3 text-[12px] text-[#9aa6a5]" onClick={() => setOrder(order === "preco" ? "numero" : "preco")} aria-pressed={order === "preco"}>
          {order === "preco" ? "Por preço" : "Por número"}
        </button>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-white/8">
        <div className="grid grid-cols-[1fr_4.5rem_4.2rem] px-3 py-2 text-[11px] text-[#7c8a8b]">
          <span>Cavalo / equipa</span>
          <span>No preço</span>
          <span className="text-right">Preço</span>
        </div>
        <ul>
          {runners.map((runner) => (
            <li key={runner.id} className="grid grid-cols-[1fr_4.5rem_4.2rem] items-center gap-2 border-t border-white/8 px-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {runner.cloth != null ? <span className="mr-1 text-[#7c8a8b] tabular">{runner.cloth}.</span> : null}
                  {runner.name}
                </p>
                <p className="truncate text-[11px] text-[#9aa6a5]">{[runner.jockey, runner.trainer].filter(Boolean).join(" · ") || "Equipa não indicada"}</p>
                <p className="truncate text-[11px] text-[#7c8a8b]">
                  {[runner.form, runner.or != null ? `OR ${runner.or}` : null, runner.weightLb != null ? kg(runner.weightLb) : null, runner.status === "NON_RUNNER" ? "Não parte" : null].filter(Boolean).join(" · ") || "Sem ficha extra"}
                </p>
              </div>
              <p className="font-display text-lg tabular">{chance(runner.decimal)}</p>
              <p className="text-right">
                <span className="block font-display text-xl tabular">{runner.fractional ?? "—"}</span>
                <span className="text-[10px] text-[#7c8a8b]">{runner.decimal != null ? "Cartão" : "Sem preço"}</span>
                {(() => {
                  const quote = quoteOf(runner.name);
                  if (!quote) return null;
                  return (
                    <span className="mt-1 block text-[10px] text-[#d7efe4]">
                      Back {quote.back.toFixed(2).replace(".", ",")} · {String(quote.percent).replace(".", ",")}%
                      {quote.valor ? " · Valor" : ""}
                    </span>
                  );
                })()}
              </p>
            </li>
          ))}
        </ul>
      </div>
      {race.runners.length === 0 ? <p className="mt-6 text-sm text-[#9aa6a5]">A fonte não publicou participantes.</p> : null}
    </div>
  );
}
