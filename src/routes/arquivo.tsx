import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { archiveList } from "@/lib/history/api";

export const Route = createFileRoute("/arquivo")({ component: Arquivo });

function Arquivo() {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [going, setGoing] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<{ id: string; name: string; off_at: string | null; origin: string; country: string | null; going: string | null }[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void archiveList({ data: { q, country, going, offset } })
      .then((page) => {
        if (!live) return;
        setRows(page.races);
        setTotal(page.total);
      })
      .catch(() => {
        if (!live) return;
        setRows([]);
        setError("Sem sessão, o arquivo fica vazio.");
      });
    return () => {
      live = false;
    };
  }, [q, country, going, offset]);
  return (
    <div>
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">{total} corridas</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">Arquivo</h1>
      <p className="mt-2 text-sm text-muted">Inclui quem perdeu, quem foi retirado e quem não concluiu, se isso veio na importação.</p>
      <input suppressHydrationWarning value={q} onChange={(event) => { setOffset(0); setQ(event.target.value); }} aria-label="Procurar corrida ou cavalo" placeholder="Corrida ou cavalo" className="input-glass mt-4 h-12 w-full px-4" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input suppressHydrationWarning value={country} onChange={(event) => { setOffset(0); setCountry(event.target.value); }} aria-label="País" placeholder="País" className="input-glass h-12 w-full px-4" />
        <input suppressHydrationWarning value={going} onChange={(event) => { setOffset(0); setGoing(event.target.value); }} aria-label="Terreno" placeholder="Terreno" className="input-glass h-12 w-full px-4" />
      </div>
      {error ? <p className="mt-4 text-sm text-muted">{error}</p> : null}
      {rows && rows.length === 0 ? <p className="glass mt-6 px-4 py-8 text-center text-sm text-muted">Nenhuma corrida importada.</p> : null}
      <div className="mt-4 space-y-2">
        {rows?.map((race) => (
          <Link key={race.id} to="/arquivo/$id" params={{ id: race.id }} className="glass block px-4 py-3">
            <span className="font-display text-xl">{race.name}</span>
            <span className="mt-1 block text-xs text-subtle">{race.off_at} · {race.country ?? "país não informado"} · {race.going ?? "terreno não informado"} · {race.origin}</span>
          </Link>
        ))}
      </div>
      {total > offset + 20 ? <button type="button" className="chip-glass mt-4 h-11 rounded-full px-4 text-sm" onClick={() => setOffset((value) => value + 20)}>Mais</button> : null}
    </div>
  );
}
