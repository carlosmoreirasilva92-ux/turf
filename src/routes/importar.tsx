import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { importUserCard } from "@/lib/racing/api";
import { parseCsv, parseImport } from "@/lib/racing/import-card";

export const Route = createFileRoute("/importar")({ component: Importar });

const SAMPLE = `{
  "races": [{
    "providerRaceId": "exemplo-1",
    "course": "Naas",
    "country": "IE",
    "discipline": "Hurdle",
    "name": "Maiden Hurdle",
    "offAt": "2026-12-01T15:00:00.000Z",
    "handicap": false,
    "runners": [
      { "name": "Alpha", "horseKey": "h1", "providerRunnerId": "h1" },
      { "name": "Beta", "horseKey": "h2", "providerRunnerId": "h2" }
    ],
    "prices": [
      { "runnerKey": "h1", "market": "WIN", "book": "casa", "decimal": 3.5, "observedAt": "2026-12-01T14:00:00.000Z" }
    ]
  }]
}`;

function Importar() {
  const [text, setText] = useState(SAMPLE);
  const [message, setMessage] = useState("");

  return (
    <div>
      <h1 className="font-display text-4xl tracking-tight">Importar</h1>
      <p className="mt-2 text-sm text-muted">
        JSON ou CSV informado por ti. Fica marcado como teu: não é verificado por uma casa e não herda o cartão fictício. offAt é UTC. A hora em que o ficheiro chega não é a hora da cotação.
      </p>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-label="Cartão JSON ou CSV"
        suppressHydrationWarning
        className="input-glass mt-4 min-h-64 w-full px-4 py-3 font-mono text-xs"
      />
      <button
        type="button"
        className="chip-holo mt-3 h-11 rounded-full px-4 text-sm"
        onClick={() => {
          const trimmed = text.trim();
          let parsed: ReturnType<typeof parseImport>;
          try {
            parsed = trimmed.startsWith("{") ? parseImport(JSON.parse(trimmed) as unknown) : parseCsv(trimmed);
          } catch {
            setMessage("O ficheiro não é JSON válido.");
            return;
          }
          if ("errors" in parsed) {
            setMessage(parsed.errors.map((issue) => issue.message).join(" "));
            return;
          }
          void importUserCard({ data: { body: { races: parsed.races }, importKey: `ui-${trimmed.length}` } })
            .then((result) => {
              if (!result.ok) setMessage(result.errors.map((issue) => issue.message).join(" "));
              else setMessage(result.replay ? "Este ficheiro já tinha sido importado." : `${result.imported} corridas gravadas, ${result.skipped} já existiam.`);
            })
            .catch(() => setMessage("Sem sessão, nada foi gravado."));
        }}
      >
        Gravar no livro
      </button>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
    </div>
  );
}
