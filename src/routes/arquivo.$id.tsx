import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Section } from "@/components/racing-ui";
import { archiveCard, historyCycle } from "@/lib/history/api";

export const Route = createFileRoute("/arquivo/$id")({ component: Ficha });

type Card = NonNullable<Awaited<ReturnType<typeof archiveCard>>>;

function Ficha() {
  const { id } = Route.useParams();
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  const [note, setNote] = useState("");
  useEffect(() => {
    void archiveCard({ data: { id } }).then(setCard).catch(() => setCard(null));
  }, [id]);
  if (card === undefined) return <p className="text-sm text-muted">A carregar a corrida…</p>;
  if (!card) return <p className="text-sm text-muted">Corrida em falta.</p>;
  return (
    <div>
      <Link to="/arquivo" className="text-xs text-subtle">Arquivo</Link>
      <h1 className="mt-1 font-display text-4xl tracking-tight">{card.name}</h1>
      <p className="mt-2 text-sm text-muted">{card.offAt} · {card.course ?? "Hipódromo não informado"} · {card.distanceM ?? "—"} m · {card.going ?? "terreno não informado"} · {card.origin}</p>
      <Section title="Antes" note={card.before.note}>
        <p className="text-sm">Previsão meteorológica: {card.before.weatherForecast ?? "não publicada"}.</p>
      </Section>
      <Section title="Depois" note={card.after.note}>
        <p className="text-sm">Clima observado: {card.after.weatherObserved ?? "não publicado"}. Estado: {card.status}.</p>
      </Section>
      <Section title="Participantes" note="Preço sem hora observada não conta como cotação pré-corrida.">
        <div className="space-y-2">
          {card.runners.map((runner) => (
            <article key={runner.id} className="glass px-4 py-3 text-sm">
              <p>{runner.name} · {runner.started ? "largou" : "não largou"} · {runner.position == null ? "sem posição" : `${runner.position}º`}</p>
              <p className="text-xs text-subtle">Carregado {runner.carriedLb ?? "—"} lb · corporal {runner.bodyKg ?? "—"} kg · SP {runner.sp?.decimal ?? "não informado"}</p>
              <p className="text-xs text-subtle">
                Pré-off {runner.preoff.length ? runner.preoff.map((price) => `${price.book} ${price.decimal} (${price.observedAt ?? "sem hora"})`).join(", ") : "sem preço"}
              </p>
            </article>
          ))}
        </div>
      </Section>
      <button
        type="button"
        className="chip-holo mt-4 h-11 rounded-full px-4 text-sm"
        onClick={() => {
          void historyCycle({ data: { raceId: id } }).then((result) => {
            setNote(result.ok ? result.steps.join(" ") : result.reason);
          }).catch(() => setNote("Sem sessão, o ciclo não correu."));
        }}
      >
        Registar o que já se sabe
      </button>
      {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
    </div>
  );
}
