import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Chip, RaceRow } from "@/components/racing-ui";
import { races } from "@/lib/racing/data";
import { DESK_YMD, fmtDayLabel } from "@/lib/racing/format";

export const Route = createFileRoute("/corridas")({ component: Corridas });

const VIEWS = [
  { id: "all", label: "Todas" },
  { id: "today", label: "Hoje" },
  { id: "qualified", label: "Qualificadas" },
  { id: "settled", label: "Liquidadas" },
  { id: "wait", label: "À espera" },
] as const;

type View = (typeof VIEWS)[number]["id"];

function Corridas() {
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return races
      .filter((race) => {
        if (view === "today" && race.date !== DESK_YMD) return false;
        if (view === "qualified" && !race.qualified) return false;
        if (view === "settled" && race.status !== "settled") return false;
        if (view === "wait" && race.status === "settled") return false;
        if (!needle) return true;
        const blob = `${race.course} ${race.name} ${race.horses.map((h) => `${h.name} ${h.jockey} ${h.trainer}`).join(" ")}`.toLowerCase();
        return blob.includes(needle);
      })
      .slice()
      .sort((a, b) => Date.parse(b.offIso) - Date.parse(a.offIso));
  }, [view, q]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const race of filtered) {
      const list = map.get(race.date) ?? [];
      list.push(race);
      map.set(race.date, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div>
      <h1 className="font-display text-4xl tracking-tight">Corridas</h1>
      <p className="mt-2 text-sm text-muted">
        O universo completo das leituras travadas, de 27 de setembro a 8 de novembro. Ganhe ou
        perca o modelo, a corrida fica no caderno.
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Procurar hipódromo ou cavalo"
        aria-label="Procurar hipódromo ou cavalo"
        className="input-glass mt-5 h-12 w-full px-4 text-base"
      />

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {VIEWS.map((item) => (
          <Chip key={item.id} active={view === item.id} onClick={() => setView(item.id)}>
            {item.label}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="glass mt-6 px-4 py-8 text-center text-sm text-muted">
          Nada corresponde. O modelo não inventa corridas.
        </p>
      ) : (
        <div className="mt-6 space-y-7">
          {groups.map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-2 text-xs font-medium tracking-[0.16em] text-subtle uppercase">
                {fmtDayLabel(day)}
                <span className="ml-2 tabular">{list.length}</span>
              </h2>
              <div className="space-y-2">
                {list.map((race) => (
                  <RaceRow key={race.id} race={race} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
