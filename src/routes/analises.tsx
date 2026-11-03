import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { liveBoard } from "@/lib/racing/live-api";
import type { LiveBoardRace } from "@/lib/racing/live-source";

export const Route = createFileRoute("/analises")({ component: Analises });

const CARDS = [
  ["Forma", "A forma publicada no cartão, sem inverter e sem probabilidade."],
  ["Pista", "Terreno e distância indicados pela fonte. Sem histórico inventado."],
  ["Mercado", "O preço mais curto mostrado. Não é uma casa e não é o SP."],
  ["Estábulo", "Jóquei e treinador do cavalo com o preço mais curto. Sem taxa de vitórias."],
  ["Peso", "Só aparece na ficha, quando a fonte publica o peso carregado."],
] as const;

function Analises() {
  const [race, setRace] = useState<LiveBoardRace | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void liveBoard()
      .then((result) => {
        if (!result.ok) {
          setError(result.reason);
          return;
        }
        const next = result.value.races.slice().sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))[0];
        setRace(next ?? null);
      })
      .catch(() => setError("O cartão público não respondeu."));
  }, []);

  return (
    <div>
      <p className="text-xs tracking-[0.16em] text-subtle uppercase">Cinco leituras · sem modelo</p>
      <h1 className="mt-2 font-display text-5xl tracking-tight">O que o cartão mostra.</h1>
      <p className="mt-2 text-sm text-muted">
        Estas linhas descrevem a próxima corrida real. Não estimam uma chance e não recebem o selo de seleção.
      </p>
      <p className="mt-3 text-sm text-muted" role="status">
        {error || (race ? `${race.course} · ${race.time ?? "hora por indicar"} · ${race.shownName ?? race.name}` : "A ler o cartão…")}
      </p>
      <ul className="mt-6 space-y-3">
        {CARDS.map(([title, body]) => (
          <li key={title} className="panel px-4 py-4">
            <h2 className="font-display text-3xl">{title}</h2>
            <p className="mt-2 text-sm text-muted">{body}</p>
            {race && title === "Mercado" ? (
              <p className="mt-3 text-sm">{race.shownName ?? "Cavalo por indicar"} · {race.shownFractional ?? "preço por indicar"}</p>
            ) : null}
            {race && title === "Estábulo" ? (
              <p className="mt-3 text-sm">{[race.shownJockey, race.shownTrainer].filter(Boolean).join(" · ") || "Ligações por indicar"}</p>
            ) : null}
            {race && title === "Pista" ? (
              <p className="mt-3 text-sm">{[race.going, race.distance, race.discipline].filter(Boolean).join(" · ") || "A fonte não indicou o terreno."}</p>
            ) : null}
          </li>
        ))}
      </ul>
      {race ? (
        <Link to="/ao-vivo/$id" params={{ id: race.id }} className="btn-mint mt-6 w-full">
          Abrir a ficha
        </Link>
      ) : null}
    </div>
  );
}
