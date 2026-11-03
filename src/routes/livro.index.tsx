import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Kpi, Section } from "@/components/racing-ui";
import { listUserRaces, sourceStatus, userExport, userFavorite, userMetrics } from "@/lib/racing/api";
import { fmtNum, fmtPct, fmtSignedPct } from "@/lib/racing/format";
import { dublinYmd, formatDublin } from "@/lib/racing/time";
import { useSim } from "@/lib/racing/sim";
import { runBankroll } from "@/lib/racing/metrics";

export const Route = createFileRoute("/livro/")({ component: Livro });

type RaceCard = {
  id: string;
  course: string;
  country: string;
  name: string;
  off_at: string;
  discipline: string;
  origin: string;
  runner_count: number;
  favorite: boolean;
};

type Metrics = Awaited<ReturnType<typeof userMetrics>>;

const DISCIPLINES = ["", "Hurdle", "Chase", "Flat", "Bumper"] as const;

function Livro() {
  const [races, setRaces] = useState<RaceCard[] | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [before, setBefore] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const { stake, setStake } = useSim();
  const today = dublinYmd(new Date());

  useEffect(() => {
    void sourceStatus()
      .then((status) => setSource(status.reason))
      .catch(() => setSource("Não foi possível ler o estado da fonte."));
  }, []);

  useEffect(() => {
    let live = true;
    setError("");
    void listUserRaces({ data: { q, country, discipline, before } })
      .then(async (page) => {
        if (!live) return;
        setRaces(page.races as RaceCard[]);
        setNext(page.next);
        setMetrics(await userMetrics());
      })
      .catch(() => {
        if (!live) return;
        setRaces([]);
        setNext(null);
        setError("Sem sessão, o livro fica vazio. A demonstração não entra aqui.");
      });
    return () => {
      live = false;
    };
  }, [q, country, discipline, before]);

  const bank = runBankroll(Number(stake) || 0, []);

  return (
    <div>
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">Livro · {today} · Dublin</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">O teu caderno</h1>
      <p className="mt-2 text-sm text-muted">
        Começa vazio. Uma corrida só aparece depois de uma importação tua ou de um provedor. O exemplo fictício não é usado quando isto falha.
      </p>
      <p className="mt-3 text-sm text-muted">{source}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/importar" className="chip-holo inline-flex h-11 items-center rounded-full px-4 text-sm">
          Importar
        </Link>
        <Link to="/" className="chip-glass inline-flex h-11 items-center rounded-full px-4 text-sm">
          Ver a demonstração
        </Link>
        <button
          type="button"
          className="chip-glass h-11 rounded-full px-4 text-sm"
          onClick={() => {
            void userExport()
              .then((book) => {
                const blob = new Blob([JSON.stringify(book, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "turf-livro.json";
                link.click();
                URL.revokeObjectURL(url);
              })
              .catch(() => setError("A exportação precisa da tua sessão."));
          }}
        >
          Exportar
        </button>
      </div>
      {error ? <p className="mt-4 text-sm text-muted">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={country === "" ? "chip-holo h-11 rounded-full px-3 text-sm" : "chip-glass h-11 rounded-full px-3 text-sm"} onClick={() => { setBefore(null); setCountry(""); }}>
          Todos
        </button>
        {["IE", "GB"].map((code) => (
          <button key={code} type="button" className={country === code ? "chip-holo h-11 rounded-full px-3 text-sm" : "chip-glass h-11 rounded-full px-3 text-sm"} onClick={() => { setBefore(null); setCountry(code); }}>
            {code}
          </button>
        ))}
        {DISCIPLINES.filter(Boolean).map((code) => (
          <button key={code} type="button" className={discipline === code ? "chip-holo h-11 rounded-full px-3 text-sm" : "chip-glass h-11 rounded-full px-3 text-sm"} onClick={() => { setBefore(null); setDiscipline(discipline === code ? "" : code); }}>
            {code}
          </button>
        ))}
      </div>
      <input
        value={q}
        onChange={(event) => {
          setBefore(null);
          setQ(event.target.value);
        }}
        placeholder="Hipódromo, corrida, cavalo, jóquei ou treinador"
        aria-label="Procurar no livro"
        suppressHydrationWarning
        className="input-glass mt-3 h-12 w-full px-4 text-base"
      />
      {races == null ? <p className="mt-6 text-sm text-muted">A carregar o livro…</p> : null}
      {races && races.length === 0 ? (
        <p className="glass mt-6 px-4 py-8 text-center text-sm text-muted">Nenhuma corrida. Não há números para preencher este vazio.</p>
      ) : null}
      <div className="mt-4 space-y-3">
        {races?.map((race) => (
          <article key={race.id} className="glass px-4 py-3">
            <p className="text-xs tracking-[0.14em] text-subtle uppercase">
              {formatDublin(race.off_at)} Dublin · {race.course} · {race.country}
            </p>
            <h2 className="mt-1 font-display text-xl">
              <Link to="/livro/$id" params={{ id: race.id }} className="underline-offset-4 hover:underline">
                {race.name}
              </Link>
            </h2>
            <p className="text-xs text-subtle">
              {race.discipline} · {race.runner_count} participantes · origem {race.origin}
            </p>
            <button
              type="button"
              className="chip-glass mt-3 h-11 rounded-full px-4 text-sm"
              onClick={() => {
                void userFavorite({ data: { raceId: race.id } })
                  .then((result) => {
                    if (!result.ok) return;
                    setRaces((current) => current?.map((item) => (item.id === race.id ? { ...item, favorite: result.favorite } : item)) ?? current);
                  })
                  .catch(() => setError("O favorito precisa da tua sessão."));
              }}
            >
              {race.favorite ? "Nos favoritos" : "Favorito"}
            </button>
          </article>
        ))}
      </div>
      {next ? (
        <button type="button" className="chip-glass mt-4 h-11 rounded-full px-4 text-sm" onClick={() => setBefore(next)}>
          Mais antigas
        </button>
      ) : null}
      <Section title="Métricas do que foi registado" note="Só entram previsões gravadas antes da largada e resultados correspondentes. Sem amostra, o valor é —. O Brier é a soma do campo, não uma nota de 0 a 1.">
        <div className="grid grid-cols-2 gap-2">
          <Kpi k="Previsões" v={metrics ? String(metrics.predictions) : "—"} />
          <Kpi k="Acerto" v={metrics?.hitRate == null ? "—" : `${fmtPct(metrics.hitRate)} (n=${metrics.hitN})`} />
          <Kpi k="Brier multiclasse" v={fmtNum(metrics?.brier, 3)} />
          <Kpi k="Log-loss" v={fmtNum(metrics?.logloss, 3)} />
          <Kpi k="ROI" v={metrics?.roi == null ? "—" : `${fmtSignedPct(metrics.roi)} (n=${metrics.roiN})`} />
          <Kpi k="CLV" v={metrics?.clv == null ? "—" : `${fmtSignedPct(metrics.clv)} (n=${metrics.clvN})`} />
        </div>
      </Section>
      <Section title="Banca" note="O valor é a banca inicial, não a movimentação. Corridas em aberto ficam reservadas e não contam como dinheiro livre. Trocar o símbolo noutro ecrã não converte câmbio. Ainda não há apostas gravadas neste ecrã, por isso a reserva é zero.">
        <input
          type="number"
          min={0}
          aria-label="Banca inicial"
          suppressHydrationWarning
          value={Number.isFinite(stake) ? stake : 0}
          onChange={(event) => setStake(event.target.value === "" ? 0 : Math.max(0, Number(event.target.value)))}
          className="input-glass h-14 w-full px-4 font-display text-3xl"
        />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Kpi k="Caixa" v={String(bank.cash)} />
          <Kpi k="Reservado" v={String(bank.reserved)} />
          <Kpi k="Disponível" v={String(bank.available)} />
        </div>
      </Section>
    </div>
  );
}