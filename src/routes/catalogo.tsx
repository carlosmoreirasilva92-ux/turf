import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CATALOG, CATALOG_VERSION } from "@/lib/history/catalog";

export const Route = createFileRoute("/catalogo")({ component: Catalogo });

function Catalogo() {
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CATALOG.filter((attr) => !needle || attr.key.includes(needle) || attr.groupName.toLowerCase().includes(needle) || attr.entity.includes(needle));
  }, [q]);
  const page = filtered.slice(offset, offset + 30);
  return (
    <div>
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">{CATALOG_VERSION} · {CATALOG.length} atributos</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">Catálogo</h1>
      <p className="mt-2 text-sm text-muted">
        Cada atributo tem entidade, tipo, fase, validação e sítio onde é guardado. O preenchimento está vazio até uma importação. Isto não é um banco de corridas já carregado.
      </p>
      <input suppressHydrationWarning value={q} onChange={(event) => { setOffset(0); setQ(event.target.value); }} aria-label="Filtrar atributos" placeholder="Chave, grupo ou entidade" className="input-glass mt-4 h-12 w-full px-4" />
      <p className="mt-3 text-xs text-subtle">{filtered.length} correspondências. A mostrar {page.length} a partir de {offset + 1}.</p>
      <div className="mt-3 space-y-2">
        {page.map((attr) => (
          <article key={attr.key} className="glass px-4 py-3 text-sm">
            <p className="font-display text-lg">{attr.key}</p>
            <p className="text-xs text-subtle">{attr.group}. {attr.groupName} · {attr.entity} · {attr.type}{attr.unit ? ` · ${attr.unit}` : ""} · {attr.phase}</p>
            <p className="mt-1 text-muted">{attr.validation}</p>
            <p className="text-xs text-subtle">Guarda: {attr.storage}. Entrada: {attr.input}. Consulta: {attr.query}. Modelo: {attr.modelPolicy}. Estado: {attr.fill}.</p>
          </article>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        {offset > 0 ? <button type="button" className="chip-glass h-11 rounded-full px-4 text-sm" onClick={() => setOffset((value) => Math.max(0, value - 30))}>Anterior</button> : null}
        {offset + 30 < filtered.length ? <button type="button" className="chip-glass h-11 rounded-full px-4 text-sm" onClick={() => setOffset((value) => value + 30)}>Seguinte</button> : null}
      </div>
    </div>
  );
}
