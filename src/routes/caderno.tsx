import { createFileRoute } from "@tanstack/react-router";
import { Chip, Kpi, Section } from "@/components/racing-ui";
import { ledger } from "@/lib/racing/data";
import { CURRENCIES, fmtMoney, fmtNum, fmtPct, fmtSignedMoney, fmtSignedPct } from "@/lib/racing/format";
import { useSim } from "@/lib/racing/sim";

export const Route = createFileRoute("/caderno")({ component: Caderno });

function Caderno() {
  const { currency, setCurrency, stake, setStake } = useSim();
  const s = Number.isFinite(stake) && stake > 0 ? stake : 0;
  const simProfit = ledger.roi != null ? ledger.roi * s * ledger.roiN : null;
  const simStaked = s * ledger.roiN;

  return (
    <div>
      <h1 className="font-display text-4xl tracking-tight">Caderno</h1>
      <p className="mt-2 text-sm text-muted [&_strong]:font-medium">
        Diário do exemplo. Os números abaixo descrevem o gerador, não previsões gravadas antes da
        largada. O livro real, com a tua sessão, mostra — enquanto não houver snapshots. Não é
        conselho de aposta (18+). O símbolo da moeda não é uma conversão cambial.
      </p>

      <Section
        title="Todas as previsões pré-corrida"
        note="Tamanho do baralho fictício. Não prova que alguma previsão tenha sido gravada antes da largada."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Kpi k="Previsões travadas" v={String(ledger.locked)} />
          <Kpi k="Período medido" v={ledger.periodLabel} />
          <Kpi k="Fuso" v="Irlanda (Dublin)" />
        </div>
      </Section>

      <Section
        title="Selecções qualificadas"
        note="Só conta como QUALIFICADA com validação prospectiva. Contar corridas ou concordar regras não chega. Este exemplo não tem esse selo."
      >
        <div className="grid grid-cols-2 gap-2">
          <Kpi k="Qualificadas" v={String(ledger.qualified)} />
          <Kpi k="Estado" v={ledger.qualified === 0 ? "nenhuma" : "no universo"} />
        </div>
        {ledger.qualifiedNote ? (
          <p className="mt-2 text-xs text-subtle">{ledger.qualifiedNote}</p>
        ) : (
          <p className="mt-2 text-xs text-subtle">
            {ledger.qualified} selecções passaram todos os controlos. O resto fica SEM APOSTA, à
            vista no cartão de cada corrida.
          </p>
        )}
      </Section>

      <Section
        title="Corridas já liquidadas"
        note="Exactidão medida só sobre previsões que já têm resultado confirmado. Amostra pequena = números pouco fiáveis."
      >
        <div className="grid grid-cols-2 gap-2">
          <Kpi k="N liquidados" v={String(ledger.settled)} />
          <Kpi k="Brier" v={fmtNum(ledger.brier, 3)} />
          <Kpi k="Log-loss" v={fmtNum(ledger.logloss, 3)} />
          <Kpi
            k={`Acerto (n=${ledger.settled})`}
            v={ledger.hitRate == null ? "—" : fmtPct(ledger.hitRate)}
          />
        </div>
      </Section>

      <Section
        title="Retorno e CLV (só com cotação real)"
        note="Exercício sobre o baralho fictício, não sobre snapshots gravados. Não é uma cotação de bookmaker e não entra no livro."
      >
        <div className="grid grid-cols-2 gap-2">
          <Kpi k="Registos elegíveis" v={String(ledger.roiN)} />
          <Kpi
            k="ROI (por unidade)"
            v={ledger.roi == null ? "—" : fmtSignedPct(ledger.roi)}
            tone={ledger.roi == null ? undefined : ledger.roi >= 0 ? "win" : "loss"}
          />
          <Kpi
            k={`CLV SP (n=${ledger.clvN})`}
            v={ledger.clv == null ? "—" : fmtSignedPct(ledger.clv)}
            tone={ledger.clv == null ? undefined : ledger.clv >= 0 ? "win" : "loss"}
          />
          <Kpi k="Com cotação real" v={String(ledger.withRealOdd)} />
        </div>
      </Section>

      <Section title="Em falta / à espera" note="Transparência: o que ainda não pode ser medido.">
        <div className="grid grid-cols-2 gap-2">
          <Kpi k="À espera de resultado" v={String(ledger.awaiting)} />
          <Kpi k="Sem cotação real" v={String(ledger.withoutRealOdd)} />
        </div>
      </Section>

      <Section
        title="Simulador ilustrativo"
        note="Apenas para dar escala: aplica o mesmo valor a cada registo já liquidado que tinha cotação real. Não é um histórico de apostas colocadas."
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="valor-por-corrida" className="text-2xs tracking-wider text-subtle uppercase">
            Valor em cada corrida
          </label>
          <div className="flex shrink-0 gap-1">
            {CURRENCIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCurrency(c.id)}
                className={
                  currency === c.id
                    ? "chip-holo h-11 min-w-11 rounded-full px-3 text-sm"
                    : "chip-glass h-11 min-w-11 rounded-full px-3 text-sm"
                }
                aria-pressed={currency === c.id}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <input
          id="valor-por-corrida"
          type="number"
          inputMode="decimal"
          min={0}
          step={5}
          aria-label="Valor em cada corrida"
          value={Number.isFinite(stake) ? stake : 0}
          onChange={(e) => setStake(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
          className="input-glass mt-2 h-14 w-full px-4 font-display text-3xl tabular"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Kpi k="Registos usados" v={String(ledger.roiN)} />
          <Kpi k="Total simulado" v={ledger.roiN ? fmtMoney(simStaked, currency) : "—"} />
          <Kpi
            k="Resultado ilustrativo"
            v={simProfit == null ? "—" : fmtSignedMoney(simProfit, currency)}
            tone={simProfit == null ? undefined : simProfit >= 0 ? "win" : "loss"}
          />
        </div>
      </Section>
    </div>
  );
}
