/**
 * WIN settlement for a single book that deducts from the profit portion of the
 * price (Rule 4 style). Not an exchange. Not each-way.
 *
 * adjusted = 1 + (odds - 1) * (1 - deduction)
 * dead heat: gross return per unit = adjusted / number of winners
 * profit = gross - 1
 *
 * Voids and non-runners return the stake and stay out of the ROI denominator.
 */

export type WinLeg = {
  odds: number;
  won: boolean;
  /** Winners sharing the dead heat, including this one. 1 when it is alone. */
  deadHeatWinners: number;
  /** Rule 4 deduction as a fraction of the profit, 0 to 1. */
  deduction: number;
  voided: boolean;
  nonRunner: boolean;
};

export type WinOutcome = {
  standing: boolean;
  profit: number;
  returned: number;
  reason: "win" | "loss" | "dead-heat" | "void" | "non-runner";
};

export function settleWin(leg: WinLeg): WinOutcome {
  if (!(leg.odds > 1) || !Number.isFinite(leg.odds)) {
    throw new Error("A odd WIN tem de ser finita e maior do que 1.");
  }
  if (leg.deduction < 0 || leg.deduction > 1 || !Number.isFinite(leg.deduction)) {
    throw new Error("A dedução tem de estar entre 0 e 1.");
  }
  if (!Number.isInteger(leg.deadHeatWinners) || leg.deadHeatWinners < 1) {
    throw new Error("O empate precisa de um número inteiro de vencedores.");
  }
  if (leg.voided) return { standing: false, profit: 0, returned: 1, reason: "void" };
  if (leg.nonRunner) return { standing: false, profit: 0, returned: 1, reason: "non-runner" };
  if (!leg.won) return { standing: true, profit: -1, returned: 0, reason: "loss" };
  const adjusted = 1 + (leg.odds - 1) * (1 - leg.deduction);
  const returned = adjusted / leg.deadHeatWinners;
  return {
    standing: true,
    profit: returned - 1,
    returned,
    reason: leg.deadHeatWinners > 1 ? "dead-heat" : "win",
  };
}

export function roiOf(outcomes: WinOutcome[]): {
  roi: number | null;
  standing: number;
  excluded: { reason: string; n: number }[];
} {
  const excluded = new Map<string, number>();
  let profit = 0;
  let standing = 0;
  for (const outcome of outcomes) {
    if (!outcome.standing) {
      excluded.set(outcome.reason, (excluded.get(outcome.reason) ?? 0) + 1);
      continue;
    }
    standing += 1;
    profit += outcome.profit;
  }
  return {
    roi: standing === 0 ? null : profit / standing,
    standing,
    excluded: [...excluded.entries()].map(([reason, n]) => ({ reason, n })),
  };
}
