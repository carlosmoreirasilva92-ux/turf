import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { importUserCard } from "@/lib/racing/api";
import { liveRace } from "@/lib/racing/live-api";
import { LIVE_BOOK, stageLabel, type LiveRace } from "@/lib/racing/live-card";
import { formatDublin } from "@/lib/racing/time";

export const Route = createFileRoute("/ao-vivo/$id")({ component: Ficha });

function Ficha() {
  const { id } = Route.useParams();
  const [race, setRace] = useState<LiveRace | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setRace(null);
    setError("");
    void liveRace({ data: { id } })
      .then((result) => {
        if (!result.ok) setError(result.reason);
        else setRace(result.value);
      })
      .catch(() => setError("A ficha pública não respondeu. Nada foi inventado."));
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

  return (
    <div>
      <p className="text-xs tracking-[0.16em] text-subtle uppercase">
        {race.course} · {race.country} · {race.time ?? "hora não indicada"} · {stageLabel(race.stage)}
      </p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">{race.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {[race.distance, race.going || "Terreno não indicado", race.discipline ?? "Tipo não indicado no nome", race.handicap ? "Handicap declarado pela fonte" : "Sem marca de handicap"].join(" · ")}
      </p>
      <p className="mt-2 text-sm text-muted" role="status">
        Preços como o cartão os mostrou às {formatDublin(race.receivedAt)} (Dublin). Não é uma casa e não é o SP. A forma está como a fonte a publicou.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/" className="chip-glass inline-flex h-11 items-center rounded-full px-4 text-sm">
          Cartão do dia
        </Link>
        <button type="button" className="chip-holo h-11 rounded-full px-4 text-sm" onClick={save}>
          Guardar cópia no livro
        </button>
        <a className="chip-glass inline-flex h-11 items-center rounded-full px-4 text-sm" href="https://www.sportinglife.com/racing/racecards">
          Fonte
        </a>
      </div>
      {note ? <p className="mt-3 text-sm text-muted" role="status">{note}</p> : null}
      <ul className="mt-6 space-y-3">
        {race.runners.map((runner) => (
          <li key={runner.id} className="glass px-4 py-3">
            <h2 className="font-display text-xl">
              {runner.cloth != null ? <span className="mr-2 text-subtle tabular">{runner.cloth}</span> : null}
              {runner.name}
            </h2>
            <p className="text-sm text-muted">
              {runner.jockey ?? "Jóquei não indicado"} · {runner.trainer ?? "Treinador não indicado"}
            </p>
            <p className="mt-1 text-sm">
              {runner.status === "RUNNER" ? "Parte" : runner.status === "NON_RUNNER" ? "Não parte" : runner.status}
              {runner.position != null ? ` · lugar ${runner.position}` : ""}
              {runner.fractional ? ` · ${runner.fractional}` : " · preço não indicado"}
              {runner.decimal != null ? ` (${runner.decimal})` : ""}
              {runner.weightLb != null ? ` · ${runner.weightLb} lb` : ""}
              {runner.or != null ? ` · OR ${runner.or}` : ""}
            </p>
            <p className="text-xs text-subtle">Forma publicada: {runner.form ?? "não indicada"}</p>
          </li>
        ))}
      </ul>
      {race.runners.length === 0 ? <p className="mt-6 text-sm text-muted">A fonte não publicou participantes.</p> : null}
    </div>
  );
}
