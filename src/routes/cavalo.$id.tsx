import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Section } from "@/components/racing-ui";
import { horseCard } from "@/lib/history/api";

export const Route = createFileRoute("/cavalo/$id")({ component: Cavalo });

type Card = NonNullable<Awaited<ReturnType<typeof horseCard>>>;

function Cavalo() {
  const { id } = Route.useParams();
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  useEffect(() => {
    void horseCard({ data: { id } }).then(setCard).catch(() => setCard(null));
  }, [id]);
  if (card === undefined) return <p className="text-sm text-muted">A carregar o perfil…</p>;
  if (!card) {
    return (
      <div>
        <h1 className="font-display text-3xl">Cavalo em falta</h1>
        <Link to="/cavalos" className="chip-glass mt-4 inline-flex h-11 items-center rounded-full px-4 text-sm">Voltar</Link>
      </div>
    );
  }
  const real = card.runs.filter((run) => run.origin !== "example");
  return (
    <div>
      <Link to="/cavalos" className="text-xs text-subtle">Cavalos</Link>
      <h1 className="mt-1 font-display text-4xl tracking-tight">{card.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {card.country ?? "País não informado"} · {card.foaledYear ?? "Ano não informado"} · {card.origin === "example" ? "exemplo, fora das métricas" : card.origin}
      </p>
      <Section title="Visão" note="Amostra real, sem o exemplo.">
        <p className="text-sm">{real.length} participações no arquivo real. Azarão operacional: {card.longshot.label}. {card.longshot.note}</p>
        <p className="mt-1 text-xs text-subtle">Sem preço elegível: {card.longshot.uncovered}. Favorito: {card.longshot.favouriteWins}/{card.longshot.favouriteRuns}.</p>
      </Section>
      <Section title="Histórico" note="Cada linha é uma participação. O resultado não altera a identidade.">
        {card.runs.length === 0 ? <p className="text-sm text-muted">Sem participações.</p> : null}
        <div className="space-y-2">
          {card.runs.map((run) => (
            <article key={run.runnerId} className="glass px-4 py-3 text-sm">
              <p className="text-xs text-subtle">{run.offAt} · {run.course ?? "Hipódromo não informado"} · {run.origin}</p>
              <p className="mt-1">{run.race} · {run.position == null ? "sem posição" : `${run.position}º`} · carregado {run.carriedLb ?? "—"} lb · corporal {run.bodyKg ?? "—"} kg</p>
              <p className="text-xs text-subtle">{run.jockey ?? "Jóquei não informado"} · {run.trainer ?? "Treinador não informado"}</p>
            </article>
          ))}
        </div>
      </Section>
      <Section title="Antes e depois" note="A previsão só pode usar a coluna da esquerda. A da direita é posterior.">
        {card.runs.slice(0, 8).map((run) => (
          <div key={run.runnerId} className="mb-3 grid gap-2 md:grid-cols-2">
            <div className="glass px-3 py-2 text-xs">
              <p className="text-subtle">Antes de {run.race}</p>
              <p>Corridas anteriores {run.knownBefore.prior_runs ?? "—"} · vitórias {run.knownBefore.prior_wins ?? "—"} · odd {run.price.decimal ?? "sem preço elegível"}</p>
            </div>
            <div className="glass px-3 py-2 text-xs">
              <p className="text-subtle">Depois</p>
              <p>Posição {run.knownAfter.position ?? "—"} · {run.knownAfter.comment ?? "comentário não publicado"}</p>
            </div>
          </div>
        ))}
      </Section>
      <Section title="Velocidade" note={card.speed.note}>
        {card.speed.points.length === 0 ? <p className="text-sm text-muted">Nada para desenhar.</p> : null}
        {card.speed.points.map((point, index) => (
          <p key={`${point.attr}-${index}`} className="text-sm">{point.attr}: {point.value ?? "—"} {point.unit ?? ""} · {point.observedAt ?? "hora não informada"}</p>
        ))}
      </Section>
      <Section title="Condições" note="Vitórias sobre largadas reais. O exemplo não entra.">
        {card.conditions.going.map((row) => (
          <p key={row.label} className="text-sm">Terreno {row.label}: {row.wins}/{row.runs}</p>
        ))}
        {card.conditions.distance.map((row) => (
          <p key={row.label} className="text-sm">Distância {row.label}: {row.wins}/{row.runs}</p>
        ))}
        {card.conditions.going.length === 0 ? <p className="text-sm text-muted">Sem largadas reais para comparar.</p> : null}
      </Section>
      <Section title="Mercado" note="Azarão de mercado, surpresa realizada e candidato de modelo são coisas diferentes.">
        <p className="text-sm">Regra {card.longshot.rule}, mínimo {card.longshot.minDecimal}. Estado do modelo: experimental, não é candidato validado.</p>
      </Section>
      <Section title="Incidentes" note="O código da queda não é um diagnóstico.">
        {card.incidents.length === 0 ? <p className="text-sm text-muted">Nenhum incidente importado.</p> : null}
        {card.incidents.map((incident, index) => (
          <p key={index} className="text-sm">{incident.kind} {incident.code ? `(${incident.code})` : ""} · {incident.cause}</p>
        ))}
      </Section>
      <Section title="Recuperação" note="Inscrição não é liberação. Afastamento não é lesão.">
        {card.episodes.length === 0 ? <p className="text-sm text-muted">Sem episódio. Retorno não informado.</p> : null}
        {card.episodes.map((episode) => (
          <div key={episode.key} className="text-sm">
            <p>{episode.cause} · {episode.returnLabel}</p>
            {episode.comeback.announced ? (
              <p className="text-xs text-subtle">
                Depois do prazo: {episode.comeback.next.length ? episode.comeback.next.map((run) => `${run.race} ${run.position ?? "—"}º`).join(" · ") : "ainda sem largada importada."}
              </p>
            ) : (
              <p className="text-xs text-subtle">Sem prazo anunciado, não há janela de retorno.</p>
            )}
          </div>
        ))}
      </Section>
      <Section title="Parcerias" note="Cada taxa tem o seu denominador. Sem amostra, não há percentagem.">
        {card.partnerships.jockey.map((row) => <p key={`j-${row.label}`} className="text-sm">Jóquei {row.label}: {row.wins}/{row.runs}</p>)}
        {card.partnerships.trainer.map((row) => <p key={`t-${row.label}`} className="text-sm">Treinador {row.label}: {row.wins}/{row.runs}</p>)}
        {card.partnerships.jockey.length === 0 ? <p className="text-sm text-muted">Sem parcerias em largadas reais.</p> : null}
      </Section>
      <Section title="Fontes" note="Sem feed externo. A origem do registo é a da importação.">
        <p className="text-sm">Chave {card.key}. Origem {card.origin}. Números em falta ficam em branco, não são estimados.</p>
      </Section>
    </div>
  );
}
