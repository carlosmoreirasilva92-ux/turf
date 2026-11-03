import { createFileRoute, Link } from "@tanstack/react-router";
import { RaceRow } from "@/components/racing-ui";
import { alignedCount } from "@/lib/racing/agents";
import { todayRaces, type Race } from "@/lib/racing/data";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const openQualified = todayRaces.filter(
    (r) => r.qualified && (r.status === "upcoming" || r.status === "off"),
  );
  const title =
    openQualified.length === 0
      ? "Hoje não há aposta."
      : openQualified.length === 1
        ? "Uma corrida qualificada."
        : `${openQualified.length} corridas qualificadas.`;

  const meetings: { course: string; races: Race[] }[] = [];
  for (const race of todayRaces) {
    const last = meetings[meetings.length - 1];
    if (!last || last.course !== race.course) meetings.push({ course: race.course, races: [race] });
    else last.races.push(race);
  }

  const focus =
    todayRaces.find((r) => r.status === "off" || r.status === "upcoming") ?? todayRaces[0];

  return (
    <div>
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">Demonstração ancorada a 2 de novembro de 2026</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-fg">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        Cartão fictício, com o relógio preso às 14:30 de Dublin. Não é o dia de hoje e não entra no livro. Nenhuma corrida recebe o selo QUALIFICADA.
      </p>
      {focus ? (
        <p className="mt-3 text-sm text-muted">
          Mesa na {focus.time} de {focus.course}: {alignedCount(focus.id)} de 5 agentes alinham com
          o modelo.{" "}
          <Link to="/agentes" className="text-accent">
            Ver agentes
          </Link>
        </p>
      ) : null}

      <div className="mt-6 space-y-8">
        {meetings.map((meeting) => (
          <section key={meeting.course} aria-labelledby={`m-${meeting.course}`}>
            <h2
              id={`m-${meeting.course}`}
              className="text-xs font-medium tracking-[0.16em] text-accent uppercase"
            >
              {meeting.course}
              <span className="ml-2 font-sans text-subtle tabular">{meeting.races.length}</span>
            </h2>
            <div className="mt-2 space-y-3">
              {meeting.races.map((race) => (
                <RaceRow key={race.id} race={race} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
