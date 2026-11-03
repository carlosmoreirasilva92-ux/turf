import { Sparkles } from "lucide-react";
import { useState } from "react";
import { readsFor } from "@/lib/racing/agents";
import { askDesk, type DeskTurn } from "@/lib/racing/desk-ai";
import { raceById } from "@/lib/racing/data";
import { explainRules } from "@/lib/racing/explain";

export function DeskChat({ raceId }: { raceId?: string }) {
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<DeskTurn[]>([]);
  const [kinds, setKinds] = useState<Array<"model" | "rules" | "error">>([]);
  const [busy, setBusy] = useState(false);

  function rules() {
    const race = raceId ? raceById(raceId) : null;
    const reads = raceId ? readsFor(raceId) : [];
    const answer = explainRules({
      course: race?.course ?? "Caderno",
      name: race?.name ?? "sem corrida",
      reads: reads.map((read) => ({ ...read, horseKey: null, version: read.version })),
      fictional: true,
    });
    setTurns((prev) => [...prev, { role: "assistant", text: answer }]);
    setKinds((prev) => [...prev, "rules"]);
  }

  async function send(question: string) {
    const text = question.trim();
    if (text.length < 2 || busy) return;
    const history = turns.slice(-6);
    setTurns((prev) => [...prev, { role: "user", text }]);
    setKinds((prev) => [...prev, "rules"]);
    setDraft("");
    setBusy(true);
    try {
      const result = await askDesk({ data: { question: text, raceId, history } });
      setTurns((prev) => [...prev, { role: "assistant", text: result.answer }]);
      setKinds((prev) => [...prev, result.kind]);
    } catch {
      setTurns((prev) => [
        ...prev,
        { role: "assistant", text: "Sem modelo de IA. A pergunta não chegou a uma sessão autorizada e não foi simulada." },
      ]);
      setKinds((prev) => [...prev, "rules"]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass mt-6 px-4 py-4" aria-labelledby="agente-ia">
      <div className="flex items-center gap-2">
        <span className="icon-circle size-8">
          <Sparkles className="size-4" />
        </span>
        <div>
          <h2 id="agente-ia" className="font-display text-xl tracking-tight">
            Leitura
          </h2>
          <p className="text-xs text-subtle">As regras respondem sem modelo. A IA, se estiver ligada, só lê o teu livro.</p>
        </div>
      </div>
      {turns.length > 0 ? (
        <ol className="mt-4 space-y-3">
          {turns.map((turn, i) => (
            <li key={`${turn.role}-${i}`} className={turn.role === "user" ? "text-sm text-fg" : "text-sm text-muted"}>
              <span className="text-2xs tracking-wider text-subtle uppercase">
                {turn.role === "user" ? "Tu" : kinds[i] === "model" ? "Modelo" : "Regras"}
              </span>
              <p className="mt-1 whitespace-pre-wrap">{turn.text}</p>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="chip-glass h-11 rounded-full px-3.5 text-sm" onClick={rules}>
          Ler pelas regras
        </button>
      </div>
      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Pergunta à mesa</span>
          <textarea
            value={draft}
            rows={2}
            maxLength={600}
            placeholder="Pergunta sobre uma corrida do teu livro"
            className="w-full resize-none rounded-2xl bg-transparent px-1 py-2 text-base text-fg outline-none placeholder:text-subtle"
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <button type="submit" className="chip-holo h-11 shrink-0 rounded-full px-4 text-sm disabled:opacity-60" disabled={busy}>
          {busy ? "A ler…" : "Perguntar à IA"}
        </button>
      </form>
    </section>
  );
}
