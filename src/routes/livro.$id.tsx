import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { userFavorite, userPrediction, userRace, userResult } from "@/lib/racing/api";
import { formatDublin } from "@/lib/racing/time";

export const Route = createFileRoute("/livro/$id")({ component: Ficha });

type Card = NonNullable<Awaited<ReturnType<typeof userRace>>>;

function Ficha() {
  const { id } = Route.useParams();
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  const [probs, setProbs] = useState<Record<string, string>>({});
  const [places, setPlaces] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  useEffect(() => {
    let live = true;
    void userRace({ data: { id } })
      .then((next) => {
        if (live) setCard(next);
      })
      .catch(() => {
        if (live) setCard(null);
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (card === undefined) return <p className="text-sm text-muted">A carregar a ficha…</p>;
  if (!card) {
    return (
      <div>
        <h1 className="font-display text-3xl tracking-tight">Corrida em falta</h1>
        <p className="mt-2 text-sm text-muted">Não está no teu livro. A demonstração não aparece aqui.</p>
        <Link to="/livro" className="chip-glass mt-4 inline-flex h-11 items-center rounded-full px-4 text-sm">
          Voltar ao livro
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/livro" className="text-sm text-accent">
        Livro
      </Link>
      <p className="mt-3 text-xs tracking-[0.14em] text-subtle uppercase">
        {formatDublin(card.offAt)} Dublin · {card.course} · {card.country} · origem {card.origin}
      </p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">{card.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {card.discipline}
        {card.distance ? ` · ${card.distance}` : ""}
        {card.going ? ` · ${card.going}` : ""}
        {card.handicap ? " · handicap declarado" : " · sem handicap declarado"}
      </p>
      <button
        type="button"
        className="chip-glass mt-3 h-11 rounded-full px-4 text-sm"
        onClick={() => {
          void userFavorite({ data: { raceId: card.id } }).then((result) => {
            if (result.ok) setCard({ ...card, favorite: result.favorite });
          });
        }}
      >
        {card.favorite ? "Nos favoritos" : "Favorito"}
      </button>

      <h2 className="mt-8 font-display text-2xl">Perspectivas</h2>
      <p className="mt-1 text-sm text-muted">Regras, não modelos. Dados em falta ou empate viram abstenção. Não inventam um cavalo.</p>
      <ul className="mt-3 space-y-2">
        {card.reads.map((read) => (
          <li key={read.id} className="glass px-4 py-3">
            <p className="text-xs tracking-[0.14em] text-subtle uppercase">
              {read.id} · {read.version} · {read.stance}
            </p>
            <p className="mt-1 text-sm">{read.horse ?? "Abstenção"}</p>
            <p className="text-xs text-muted">{read.note}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 font-display text-2xl">Participantes</h2>
      <ul className="mt-3 space-y-3">
        {card.runners.map((runner) => (
          <li key={runner.id} className="glass px-4 py-3">
            <p className="font-medium">
              {runner.cloth ? `${runner.cloth}. ` : ""}
              {runner.name}
            </p>
            <p className="text-xs text-subtle">
              {runner.jockey ?? "Jóquei por declarar"} · {runner.trainer ?? "Treinador por declarar"}
            </p>
            <p className="text-xs text-muted">
              {runner.price
                ? `${runner.price.book} ${runner.price.decimal} · observada ${runner.price.observedAt ? formatDublin(runner.price.observedAt) : "sem hora"} · recebida ${formatDublin(runner.price.receivedAt)}`
                : "Sem cotação"}
            </p>
            <label className="mt-2 block text-xs text-subtle">
              Probabilidade informada por ti
              <input
                inputMode="decimal"
                aria-label={`Probabilidade de ${runner.name}`}
                suppressHydrationWarning
                value={probs[runner.id] ?? ""}
                onChange={(event) => setProbs({ ...probs, [runner.id]: event.target.value })}
                className="input-glass mt-1 h-11 w-full px-3"
              />
            </label>
            <label className="mt-2 block text-xs text-subtle">
              Lugar informado por ti
              <input
                inputMode="numeric"
                aria-label={`Lugar de ${runner.name}`}
                suppressHydrationWarning
                value={places[runner.id] ?? ""}
                onChange={(event) => setPlaces({ ...places, [runner.id]: event.target.value })}
                className="input-glass mt-1 h-11 w-full px-3"
              />
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        A distribuição não é calculada por um modelo. A soma tem de ser 1. O registo só entra se o servidor ainda estiver antes da largada, e não é reescrito.
      </p>
      <button
        type="button"
        className="chip-holo mt-3 h-11 rounded-full px-4 text-sm"
        onClick={() => {
          const probabilities = card.runners.map((runner) => ({ runnerId: runner.id, p: Number(probs[runner.id]) }));
          void userPrediction({ data: { raceId: card.id, probabilities, pickRunnerId: null } })
            .then((result) => setNote("reason" in result && !result.ok ? result.reason : result.ok && result.replay ? "Este registo já existia." : "Previsão gravada. Continua experimental."))
            .catch(() => setNote("Sem sessão, nada foi gravado."));
        }}
      >
        Gravar distribuição
      </button>
      <button
        type="button"
        className="chip-glass mt-3 ml-2 h-11 rounded-full px-4 text-sm"
        onClick={() => {
          const runners = card.runners.map((runner) => {
            const raw = places[runner.id]?.trim().toLowerCase();
            if (raw === "nr") return { runnerId: runner.id, position: null, nonRunner: true };
            const position = raw ? Number(raw) : null;
            return { runnerId: runner.id, position, nonRunner: false };
          });
          void userResult({ data: { raceId: card.id, status: "official", runners } })
            .then((result) => setNote(!result.ok ? result.reason : result.replay ? "Este resultado já estava gravado." : "Resultado gravado como informado por ti."))
            .catch(() => setNote("Sem sessão, o resultado não foi gravado."));
        }}
      >
        Gravar resultado
      </button>
      {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
    </div>
  );
}
