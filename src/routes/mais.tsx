import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/mais")({ component: Mais });

const LINKS = [
  { to: "/arquivo", title: "Arquivo", note: "Corridas importadas, com o que se sabia antes e o que só se soube depois." },
  { to: "/joqueis", title: "Jóqueis", note: "Amostra, vitórias e disponibilidade publicada. Sem ficha clínica." },
  { to: "/treinadores", title: "Treinadores", note: "Estábulo e resultados ligados a cada participação." },
  { to: "/fontes", title: "Fontes", note: "Importar, cobertura, ciclo e treino experimental." },
  { to: "/catalogo", title: "Catálogo", note: "431 atributos. Vazio até haver uma fonte." },
  { to: "/caderno", title: "Caderno", note: "Demonstração. Não entra no arquivo." },
  { to: "/agentes", title: "Agentes", note: "Regras da demonstração." },
  { to: "/livro", title: "Livro", note: "Previsões gravadas do caderno de apostas experimental." },
] as const;

function Mais() {
  return (
    <div>
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">Arquivo</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">O resto do caderno</h1>
      <div className="mt-4 space-y-2">
        {LINKS.map((item) => (
          <Link key={item.to} to={item.to} className="glass block px-4 py-3">
            <span className="font-display text-xl">{item.title}</span>
            <span className="mt-1 block text-sm text-muted">{item.note}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
