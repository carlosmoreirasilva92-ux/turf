import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listSubjects } from "@/lib/history/api";

export function People({ kind, title }: { kind: "jockey" | "trainer"; title: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<{ id: string; name: string; country: string | null; origin: string }[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void listSubjects({ data: { kind, q } })
      .then((page) => {
        if (!live) return;
        setRows(page.entities);
        setTotal(page.total);
      })
      .catch(() => {
        if (!live) return;
        setRows([]);
        setError("Sem sessão, a lista fica vazia.");
      });
    return () => {
      live = false;
    };
  }, [kind, q]);
  const to = kind === "jockey" ? "/joquei/$id" : "/treinador/$id";
  return (
    <div>
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">{total} no arquivo</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">{title}</h1>
      <input suppressHydrationWarning value={q} onChange={(event) => setQ(event.target.value)} aria-label={`Procurar ${title}`} placeholder="Nome" className="input-glass mt-4 h-12 w-full px-4" />
      {error ? <p className="mt-4 text-sm text-muted">{error}</p> : null}
      {rows && rows.length === 0 ? <p className="glass mt-6 px-4 py-8 text-center text-sm text-muted">Ninguém importado.</p> : null}
      <div className="mt-4 space-y-2">
        {rows?.map((person) => (
          <Link key={person.id} to={to} params={{ id: person.id }} className="glass block px-4 py-3">
            <span className="font-display text-xl">{person.name}</span>
            <span className="mt-1 block text-xs text-subtle">{person.origin === "example" ? "exemplo" : person.origin}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
