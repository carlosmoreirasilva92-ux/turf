import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { personCard } from "@/lib/history/api";

type Card = NonNullable<Awaited<ReturnType<typeof personCard>>>;

export function Person({ id, back, backLabel }: { id: string; back: "/joqueis" | "/treinadores"; backLabel: string }) {
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  useEffect(() => {
    void personCard({ data: { id } }).then(setCard).catch(() => setCard(null));
  }, [id]);
  if (card === undefined) return <p className="text-sm text-muted">A carregar…</p>;
  if (!card) return <p className="text-sm text-muted">Perfil em falta.</p>;
  return (
    <div>
      <Link to={back} className="text-xs text-subtle">{backLabel}</Link>
      <h1 className="mt-1 font-display text-4xl tracking-tight">{card.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {card.sample} largadas reais · {card.wins} vitórias · taxa {card.rate == null ? "—" : `${Math.round(card.rate * 1000) / 10}%`}
      </p>
      <p className="mt-2 text-sm text-muted">{card.health}</p>
      <div className="mt-4 space-y-2">
        {card.runs.length === 0 ? <p className="glass px-4 py-6 text-sm text-muted">Sem participações.</p> : null}
        {card.runs.map((run, index) => (
          <article key={index} className="glass px-4 py-3 text-sm">
            <p>{run.offAt} · {run.race}</p>
            <p className="text-xs text-subtle">{run.position == null ? "sem posição" : `${run.position}º`} · {run.origin}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
