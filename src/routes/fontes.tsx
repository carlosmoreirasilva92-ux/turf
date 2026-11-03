import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { historyCoverage, historyTrain, importHistoryCard } from "@/lib/history/api";
import { parseHistoryCsv } from "@/lib/history/csv";
import { parseHistoryPack } from "@/lib/history/import-pack";

export const Route = createFileRoute("/fontes")({ component: Fontes });

const SAMPLE = `{
  "origin": "user",
  "entities": [
    { "kind": "horse", "key": "h1", "name": "Alpha" },
    { "kind": "horse", "key": "h2", "name": "Beta" }
  ],
  "courses": [{ "key": "naas", "name": "Naas", "country": "IE" }],
  "races": [{
    "key": "r1",
    "courseKey": "naas",
    "name": "Maiden Hurdle",
    "offAt": "2026-12-01T15:00:00.000Z",
    "going": "Soft",
    "distanceM": 3200,
    "runners": [
      { "horseKey": "h1", "carriedLb": 154, "bodyKg": 480, "started": true, "prices": [{ "book": "casa", "market": "WIN", "decimal": 11, "kind": "preoff", "observedAt": "2026-12-01T14:00:00.000Z" }] },
      { "horseKey": "h2", "carriedLb": 150, "started": true, "prices": [{ "book": "casa", "market": "WIN", "decimal": 3.5, "kind": "preoff", "observedAt": "2026-12-01T14:00:00.000Z" }] }
    ]
  }]
}`;

function Fontes() {
  const [text, setText] = useState(SAMPLE);
  const [message, setMessage] = useState("");
  const [coverage, setCoverage] = useState<Awaited<ReturnType<typeof historyCoverage>> | null>(null);
  useEffect(() => {
    void historyCoverage().then(setCoverage).catch(() => setCoverage(null));
  }, [message]);
  return (
    <div>
      <h1 className="font-display text-4xl tracking-tight">Fontes</h1>
      <p className="mt-2 text-sm text-muted">
        Não há provedor ligado. Falta TURF_PROVIDER_URL e TURF_PROVIDER_KEY. JSON ou CSV com secções #. A demonstração do dia 2 de novembro não entra aqui.
      </p>
      <p className="mt-3 text-sm text-muted">{coverage?.provider ?? "A cobertura aparece depois da sessão."}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {coverage?.fields.map((field) => (
          <li key={field.field}>{field.field}: {field.filled} preenchidos, {field.missing} em falta. Total considerado {field.filled + field.missing}.</li>
        ))}
      </ul>
      <textarea suppressHydrationWarning value={text} onChange={(event) => setText(event.target.value)} aria-label="Pacote histórico JSON ou CSV" className="input-glass mt-4 min-h-64 w-full px-4 py-3 font-mono text-xs" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="chip-holo h-11 rounded-full px-4 text-sm"
          onClick={() => {
            const trimmed = text.trim();
            let body: unknown;
            if (trimmed.startsWith("{")) {
              try {
                body = JSON.parse(trimmed);
              } catch {
                setMessage("JSON inválido.");
                return;
              }
            }
            const preview = trimmed.startsWith("{") ? parseHistoryPack(body) : parseHistoryCsv(trimmed);
            if ("errors" in preview) {
              setMessage(preview.errors.map((issue) => issue.message).join(" "));
              return;
            }
            void importHistoryCard({ data: { body: preview.pack, importKey: "auto" } })
              .then((result) => {
                if (!result.ok) setMessage(result.errors.map((issue) => issue.message).join(" "));
                else setMessage(result.replay ? "Este pacote já tinha sido importado." : "Pacote gravado. Exemplo e dados reais não se misturam nas métricas.");
              })
              .catch(() => setMessage("Sem sessão, nada foi gravado."));
          }}
        >
          Validar e gravar
        </button>
        <button
          type="button"
          className="chip-glass h-11 rounded-full px-4 text-sm"
          onClick={() => {
            void historyTrain()
              .then((result) => setMessage(result.ok ? `${result.reason} Log-loss ${result.model.logloss}. Sem mercado ${result.withoutMarket.logloss}. Top 3 ${result.place.logloss}. Continua ${result.status}.` : result.reason))
              .catch(() => setMessage("Sem sessão, o treino não correu."));
          }}
        >
          Treinar baseline experimental
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
    </div>
  );
}
