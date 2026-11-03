import { fromWinPrices, logLoss, multiclassBrier, uniform, type Distribution } from "./metrics.ts";

export type Timed = { id: string; offAt: string };

export type Folds<T> = {
  train: T[];
  calibrate: T[];
  test: T[];
};

/**
 * Time-ordered folds. A race stays whole: it cannot sit in two folds.
 * train < trainEnd <= calibrate < testStart <= test.
 */
export function assignFolds<T extends Timed>(rows: T[], trainEnd: string, testStart: string): Folds<T> {
  const trainMs = Date.parse(trainEnd);
  const testMs = Date.parse(testStart);
  if (!(trainMs < testMs)) throw new Error("O período de calibração tem de ficar entre o treino e o teste.");
  const folds: Folds<T> = { train: [], calibrate: [], test: [] };
  for (const row of rows) {
    const off = Date.parse(row.offAt);
    if (off < trainMs) folds.train.push(row);
    else if (off < testMs) folds.calibrate.push(row);
    else folds.test.push(row);
  }
  return folds;
}

export type Scored = { brier: number | null; logloss: number | null };

export function scoreFold(
  probs: Distribution[],
  winner: string,
): Scored {
  return { brier: multiclassBrier(probs, winner), logloss: logLoss(probs, winner) };
}

export function baselines(keys: string[], prices: { key: string; decimal: number | null }[], winner: string) {
  return {
    uniform: scoreFold(uniform(keys), winner),
    market: scoreFold(fromWinPrices(prices) ?? [], winner),
  };
}
