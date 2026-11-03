import { createFileRoute, Link } from "@tanstack/react-router";
import { Database, Flag, Layers, Lock, Shield, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/como")({ component: Como });

const BLOCKS = [
  {
    icon: Layers,
    title: "A leitura do cartão de hoje",
    body: "A percentagem de Hoje é 1 a dividir pelo preço publicado. Não é um modelo treinado e não quer dizer que o cavalo vai vencer. O preço mais curto é o favorito desse cartão, não uma seleção qualificada. Distância, piso e jóquei aparecem como a fonte os publicou.",
  },
  {
    icon: Lock,
    title: "O registo antes da largada",
    body: "Travar uma cópia no livro guarda o cavalo, o preço, a fonte e a hora. Uma leitura depois da largada não entra como previsão. O caderno de demonstração é outro sítio: cavalos e resultados de exemplo, só neste navegador.",
  },
  {
    icon: TrendingUp,
    title: "Retorno e simulador",
    body: "ROI é o lucro líquido a dividir pelas unidades apostadas. Só entram leituras liquidadas com um preço observado antes da largada. O simulador repete o mesmo valor em cada corrida. O total movimentado é a soma dessas apostas, não uma banca. Não há reinvestimento nem aposta feita por ti.",
  },
  {
    icon: Flag,
    title: "Resultados",
    body: "Conta o vencedor. Anulação e não participante devolvem a unidade e ficam fora do ROI. Em empate, o retorno divide-se pelos vencedores. Se houver uma dedução do tipo Rule 4, ela reduz o lucro do preço antes dessa divisão. Não há each-way nem regras de exchange.",
  },
  {
    icon: Shield,
    title: "Qualidade das probabilidades",
    body: "Brier soma o erro de todos os participantes. Log-loss olha para a probabilidade dada ao vencedor. Menor é melhor. O acerto é a frequência com que o líder registado ganhou. Anulações, empates e corridas com retirados ficam de fora. Sem amostra, o número fica em branco.",
  },
  {
    icon: Database,
    title: "CLV e fontes",
    body: "CLV de preço é a odd registada a dividir pela odd de fecho, menos 1. Exige a mesma casa e um fecho observado entre o registo e a largada. Não tira a margem da casa. O cartão de hoje não traz essa casa nem o SP, por isso o CLV do dia fica em branco. A importação JSON ou CSV está em Fontes. Uma API paga não está ligada.",
  },
] as const;

function Como() {
  return (
    <div>
      <p className="text-[10px] tracking-[0.16em] text-[#7c8a8b]">TRANSPARÊNCIA, EM PRIMEIRO LUGAR</p>
      <h1 className="mt-2 font-display text-[2.4rem] leading-none tracking-tight">Como a mesa funciona.</h1>
      <p className="mt-3 text-[13px] text-[#9aa6a5]">Um programa para ver o cartão, registar e conferir. Cada número tem uma origem.</p>
      <div className="mt-5 space-y-3">
        {BLOCKS.map((block) => {
          const Icon = block.icon;
          return (
            <section key={block.title} className="rounded-xl border border-white/8 bg-[#13191c] px-4 py-4">
              <h2 className="flex items-center gap-2 font-display text-[1.35rem]">
                <Icon className="size-4 text-[#b5d8c8]" aria-hidden="true" />
                {block.title}
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[#9aa6a5]">{block.body}</p>
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-[12px] text-[#7c8a8b]">
        18+. Não é conselho de aposta.{" "}
        <Link to="/fontes" className="text-[#b5d8c8]">Fontes</Link>
        {" · "}
        <Link to="/caderno" className="text-[#b5d8c8]">Caderno de exemplo</Link>
      </p>
    </div>
  );
}
