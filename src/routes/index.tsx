import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { liveDay } from "@/lib/racing/live-api";
import { stageLabel, type LiveDay } from "@/lib/racing/live-card";
import { formatDublin } from "@/lib/racing/time";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [day, setDay] = useState<LiveDay | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState<"IEGB" | "IE" | "GB" | "">("IEGB");
  const [q, setQ] = useState("");

  function load() {
    setLoading(true);
    void liveDay()
      .then((result) => {
        if (!result.ok) {
          setDay(null);
          setError(result.reason);
          return;
        }
        setError("");
        setDay(result.value);
      })
      .catch(() => {
        setDay(null);
        setError("O cartão público não respondeu. A demonstração não foi usada no lugar.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 180_000);
    return () => window.clearInterval(timer);
  }, []);

  const needle = q.trim().toLowerCase();
  const meetings =
    day?.meetings
      .map((meeting) => ({
        ...meeting,
        races: meeting.races.filter((race) => {
          const place = country === "IEGB" ? race.country === "IE" || race.country === "GB" : country === "" || race.country === country;
          if (!place) return false;
          if (!needle) return true;
          return `${race.course} ${race.name}`.toLowerCase().includes(needle);
        }),
      }))
      .filter((meeting) => meeting.races.length > 0) ?? [];

  return (
    <div>
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">Hoje · cartão público · Dublin</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">O cartão do dia</h1>
      <p className="mt-2 text-sm text-muted">
        Reuniões lidas do cartão que o site Sporting Life publica sem login. Não é uma casa, não é o SP oficial e não é uma previsão. Se a leitura falhar, a demonstração de 2 de novembro não entra aqui.
      </p>
      <p className="mt-2 text-sm">
        <a className="text-accent" href="https://www.sportinglife.com/racing/racecards">
          Abrir a fonte
        </a>
        <span className="text-subtle"> · </span>
        <Link to="/caderno" className="text-accent">
          Demonstração fictícia
        </Link>
      </p>
      <p className="mt-3 text-sm text-muted" role="status">
        {loading ? "A ler o cartão público…" : null}
        {!loading && error ? error : null}
        {!loading && day ? `Lido às ${formatDublin(day.receivedAt)} (Dublin). Atualiza sozinho de três em três minutos.` : null}
      </p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="País">
        {(
          [
            ["IEGB", "Irlanda e Grã-Bretanha"],
            ["IE", "IE"],
            ["GB", "GB"],
            ["", "Todos"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id || "all"}
            type="button"
            aria-pressed={country === id}
            className={country === id ? "chip-holo h-11 rounded-full px-3 text-sm" : "chip-glass h-11 rounded-full px-3 text-sm"}
            onClick={() => setCountry(id)}
          >
            {label}
          </button>
        ))}
        <button type="button" className="chip-glass h-11 rounded-full px-3 text-sm" onClick={load}>
          Atualizar
        </button>
      </div>
      <input
        suppressHydrationWarning
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Hipódromo ou corrida"
        aria-label="Procurar no cartão de hoje"
        className="input-glass mt-3 h-12 w-full px-4 text-base"
      />
      {!loading && day && meetings.length === 0 ? (
        <p className="glass mt-6 px-4 py-8 text-center text-sm text-muted">A fonte não publicou reuniões para este filtro.</p>
      ) : null}
      <div className="mt-6 space-y-8">
        {meetings.map((meeting) => (
          <section key={meeting.id} aria-labelledby={`m-${meeting.id}`}>
            <h2 id={`m-${meeting.id}`} className="text-xs font-medium tracking-[0.16em] text-accent uppercase">
              {meeting.course}
              <span className="ml-2 font-sans text-subtle">
                {meeting.country}
                {meeting.going ? ` · ${meeting.going}` : ""}
              </span>
            </h2>
            <ul className="mt-2 space-y-3">
              {meeting.races.map((race) => (
                <li key={race.id}>
                  <Link
                    to="/ao-vivo/$id"
                    params={{ id: race.id }}
                    className="glass block px-4 py-3"
                  >
                    <p className="text-xs tracking-[0.14em] text-subtle uppercase">
                      {race.time ?? "Hora não indicada"} · {stageLabel(race.stage)}
                      {race.runnersDeclared != null ? ` · ${race.runnersDeclared} no cartão` : ""}
                    </p>
                    <p className="mt-1 font-display text-xl">{race.name}</p>
                    <p className="text-xs text-subtle">
                      {[race.distance, race.discipline ?? "Tipo não indicado no nome", race.handicap ? "handicap" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
