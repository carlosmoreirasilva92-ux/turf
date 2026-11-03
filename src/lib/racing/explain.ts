import type { PerspectiveRead } from "./perspectives.ts";

export function explainRules(input: {
  course: string;
  name: string;
  reads: PerspectiveRead[];
  fictional: boolean;
}): string {
  const lines = [
    input.fictional
      ? "Sem modelo de IA. Isto é a demonstração fictícia, lida pelas regras, sem chamada a um modelo."
      : "Sem modelo de IA. Explicação determinística das regras sobre o cartão guardado.",
    `${input.course}, ${input.name}. O selo QUALIFICADA não é atribuído: o modelo está experimental.`,
  ];
  for (const read of input.reads) {
    const who = read.horse ?? "abstenção";
    lines.push(`${read.id}: ${who}. ${read.note}`);
  }
  lines.push("Concordância entre regras não aumenta a probabilidade. Não é conselho de aposta.");
  return lines.join(" ");
}
