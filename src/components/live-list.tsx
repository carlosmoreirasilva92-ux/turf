import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Chip } from "@/components/racing-ui";
import { liveBoard, liveDay } from "@/lib/racing/live-api";
import { stageLabel, type LiveDay } from "@/lib/racing/live-card";
import type { LiveBoard } from "@/lib/racing/live-source";
import { formatDublin } from "@/lib/racing/time";

const SCOPES = [
  { id: "IEGB", label: "Irlanda e Grã-Bretanha" },
  { id: "IE", label: "IE" },
  { id: "GB", label: "GB" },
  { id: "", label: "Todos" },
] as const;

export function LiveList({ title }: { title: string }) {
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
  const meetings =
    day?.meetings
      .map((meeting) => ({
        ...meeting,
        races: meeting.races.filter((race) => {
          const place = scope === "IEGB" ? race.country === "IE" || race.country === "GB" : scope === "" || race.country === scope;
          if (!place) return false;
          const shown = prices.get(race.id);
          const blob = `${race.course} ${race.name} ${shown?.shownName ?? ""} ${shown?.shownJockey ?? ""} ${shown?.shownTrainer ?? ""}`.toLowerCase();
          return !needle || blob.includes(needle);
        }),
      }))
      .filter((meeting) => meeting.races.length > 0)
      .sort((a, b) => (a.races[0]?.time ?? "").localeCompare(b.races[0]?.time ?? "")) ?? [];

  return (
    <div>
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">Cartão público · atualizado a cada minuto</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        Corridas reais de hoje, lidas do cartão que a Sporting Life publica sem login. O preço é o mais curto mostrado nesse cartão, não uma probabilidade nossa e não o SP.
      </p>
      <p className="mt-3 text-sm text-muted" role="status">
        {loading ? "A ler o cartão público…" : null}
        {!loading && error ? error : null}
        {!loading && day ? `Lido às ${formatDublin(board?.receivedAt ?? day.receivedAt)} (Dublin).` : null}
        {board ? "" : day ? " A abrir os cavalos da Irlanda e da Grã-Bretanha…" : ""}
      </p>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="País">
        {SCOPES.map((item) => (
          <Chip key={item.id || "all"} active={scope === item.id} onClick={() => setScope(item.id)}>
            {item.label}
          </Chip>
        ))}
      </div>
      <input
        suppressHydrationWarning
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Hipódromo, corrida ou cavalo"
        aria-label="Procurar hipódromo, corrida ou cavalo"
        className="input-glass mt-4 h-12 w-full px-4 text-base"
      />
      {!loading && day && meetings.length === 0 ? (
        <p className="glass mt-6 px-4 py-8 text-center text-sm text-muted">A fonte não publicou corridas para este filtro.</p>
      ) : null}
      <div className="mt-6 space-y-8">
        {meetings.map((meeting) => (
          <section key={meeting.id} aria-labelledby={`live-${meeting.id}`}>
            <h2 id={`live-${meeting.id}`} className="text-xs font-medium tracking-[0.16em] text-accent uppercase">
              {meeting.course}
              <span className="ml-2 font-sans text-subtle">
                {" · "}
                {meeting.country}
                {meeting.going ? ` · ${meeting.going}` : ""}
                <span className="tabular"> · {meeting.races.length}</span>
              </span>
            </h2>
            <ul className="mt-2 space-y-3">
              {meeting.races.map((race) => {
                const shown = prices.get(race.id);
                return (
                  <li key={race.id}>
                    <Link to="/ao-vivo/$id" params={{ id: race.id }} className="glass block px-4 py-3">
                      <p className="text-xs tracking-[0.14em] text-subtle uppercase">
                        {race.time ?? "Hora não indicada"} · {race.country} · {stageLabel(race.stage)}
                      </p>
                      <p className="mt-1 font-display text-2xl tracking-tight">{race.name}</p>
                      <p className="text-xs text-subtle">
                        {[race.distance, race.discipline ?? "Tipo não indicado no nome", race.going || meeting.going, shown?.field != null ? `${shown.field} no cartão` : race.runnersDeclared != null ? `${race.runnersDeclared} no cartão` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-3 flex items-end justify-between gap-3">
                        <span>
                          <span className="block text-sm">{shown?.shownName ?? "A abrir os participantes…"}</span>
                          <span className="block text-xs text-subtle">
                            {shown?.shownName
                              ? [shown.shownJockey, shown.shownTrainer].filter(Boolean).join(" · ") || "Ligações não indicadas"
                              : "Sem exemplo no lugar"}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block font-display text-2xl tabular">{shown?.shownFractional ?? "—"}</span>
                          <span className="block text-2xs text-subtle">{shown?.shownDecimal != null ? shown.shownDecimal : "preço por indicar"}</span>
                        </span>
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
