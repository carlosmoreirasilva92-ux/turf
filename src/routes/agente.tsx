import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/agente")({ component: Agente });

function Agente() {
  const [text, setText] = useState("A ler o cartão para o agente…");
  useEffect(() => {
    void fetch("/api/agente/hoje?aposta=10")
      .then(async (response) => {
        const body = await response.json();
        setText(JSON.stringify(body, null, 2));
      })
      .catch(() => setText("O agente não conseguiu ler o cartão agora."));
  }, []);
  return (
    <div>
      <p className="text-[10px] tracking-[0.16em] text-[#7c8a8b]">PARA O AGENTE GROK</p>
      <h1 className="mt-2 font-display text-[2.2rem] leading-none tracking-tight">A mesa, em JSON.</h1>
      <p className="mt-3 text-[13px] text-[#9aa6a5]">
        O agente lê <span className="text-[#d7efe4]">/api/agente/fontes</span>, depois <span className="text-[#d7efe4]">/api/agente/hoje</span> e <span className="text-[#d7efe4]">/api/agente/corrida/id</span>. A fonte ativa é o cartão público. A conta da casa não é aberta daqui.
      </p>
      <pre className="mt-4 max-h-[28rem] overflow-auto rounded-xl border border-white/8 bg-[#0e1417] p-3 text-[11px] leading-relaxed text-[#d7efe4]">{text}</pre>
    </div>
  );
}
