import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listSubjects } from "@/lib/history/api";

export const Route = createFileRoute("/cavalos")({ component: Cavalos });

function Cavalos() {
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<{ id: string; name: string; country: string | null; origin: string }[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void listSubjects({ data: { kind: "horse", q, offset } })
      .then((page) => {
        if (!live) return;
        setRows(page.entities);
        setTotal(page.total);
      })
      .catch(() => {
        if (!live) return;
        setRows([]);
        setError("Sem sessão, o arquivo fica vazio. A demonstração não entra aqui.");
      });
    return () => {
      live = false;
    };
  }, [q, offset]);

  return (
    <div>
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">Cavalos · {total} no arquivo</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">Quem correu</h1>
      <p className="mt-2 text-sm text-muted">Um nome repetido não junta dois animais. Cada um tem a sua chave e as suas participações.</p>
      <input suppressHydrationWarning value={q} onChange={(event) => { setOffset(0); setQ(event.target.value); }} placeholder="Nome" aria-label="Procurar cavalo" className="input-glass mt-4 h-12 w-full px-4" />
      {error ? <p className="mt-4 text-sm text-muted">{error}</p> : null}
      {rows && rows.length === 0 ? <p className="glass mt-6 px-4 py-8 text-center text-sm text-muted">Nenhum cavalo importado.</p> : null}
      <div className="mt-4 space-y-2">
        {rows?.map((horse) => (
          <Link key={horse.id} to="/cavalo/$id" params={{ id: horse.id }} className="glass block px-4 py-3">
            <span className="font-display text-xl">{horse.name}</span>
            <span className="mt-1 block text-xs text-subtle">{horse.country ?? "País não informado"} · {horse.origin === "example" ? "exemplo" : horse.origin}</span>
          </Link>
        ))}
      </div>
      {total > offset + 20 ? (
        <button type="button" className="chip-glass mt-4 h-11 rounded-full px-4 text-sm" onClick={() => setOffset((value) => value + 20)}>
          Mais
        </button>
      ) : null}
    </div>
  );
}
