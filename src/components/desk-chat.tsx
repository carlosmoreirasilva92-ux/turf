import { Sparkles } from "lucide-react";
import { useState } from "react";
import { askDesk, type DeskTurn } from "@/lib/racing/desk-ai";

const OPEN = ["O caderno está a ganhar?", "Qual agente acerta mais?", "Hoje há aposta?"];
const RACE = ["Porque não está qualificada?", "Quem a mesa nomeia?", "O favorito alinha com o modelo?"];

export function DeskChat({ raceId }: { raceId?: string }) {
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<DeskTurn[]>([]);
  const [busy, setBusy] = useState(false);

  async function send(question: string) {
    const text = question.trim();
    if (text.length < 2 || busy) return;
    const history = turns.slice(-6);
    setTurns((prev) => [...prev, { role: "user", text }]);
    setDraft("");
    setBusy(true);
    try {
      const result = await askDesk({ data: { question: text, raceId, history } });
      setTurns((prev) => [...prev, { role: "assistant", text: result.answer }]);
    } catch {
      setTurns((prev) => [
        ...prev,
        { role: "assistant", text: "Não consegui falar com o agente. Tenta outra vez." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const ideas = raceId ? RACE : OPEN;

  return (
    <section className="glass mt-6 px-4 py-4" aria-labelledby="agente-ia">
      <div className="flex items-center gap-2">
        <span className="icon-circle size-8">
          <Sparkles className="size-4" />
        </span>
        <div>
          <h2 id="agente-ia" className="font-display text-xl tracking-tight">
            Agente
          </h2>
          <p className="text-xs text-subtle">Lê o cartão travado. Não é conselho de aposta.</p>
        </div>
      </div>

      {turns.length > 0 ? (
        <ol className="mt-4 space-y-3">
          {turns.map((turn, i) => (
            <li
              key={`${turn.role}-${i}`}
              data-desk-answer={turn.role === "assistant" ? "1" : undefined}
              className={turn.role === "user" ? "text-sm text-fg" : "text-sm text-muted"}
            >
              <span className="text-2xs tracking-wider text-subtle uppercase">
                {turn.role === "user" ? "Tu" : "Mesa"}
              </span>
              <p className="mt-1 whitespace-pre-wrap">{turn.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {ideas.map((idea) => (
            <button
              key={idea}
              type="button"
              className="chip-glass h-11 rounded-full px-3.5 text-sm"
              onClick={() => void send(idea)}
            >
              {idea}
            </button>
          ))}
        </div>
      )}

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
            placeholder="Pergunta sobre este cartão"
            className="w-full resize-none rounded-2xl bg-transparent px-1 py-2 text-base text-fg outline-none placeholder:text-subtle"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
          />
        </label>
        <button type="submit" className="chip-holo h-11 shrink-0 rounded-full px-4 text-sm disabled:opacity-60" disabled={busy}>
          {busy ? "A ler…" : "Perguntar"}
        </button>
      </form>
    </section>
  );
}
