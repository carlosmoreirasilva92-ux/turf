import { useEffect, useState } from "react";
import type { Currency } from "@/lib/racing/format";

const KEY = "turf-sim";

function isCurrency(v: unknown): v is Currency {
  return v === "EUR" || v === "BRL" || v === "GBP" || v === "USD";
}

export function useSim() {
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [stake, setStake] = useState(100);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { currency?: unknown; stake?: unknown };
        if (isCurrency(parsed.currency)) setCurrency(parsed.currency);
        if (typeof parsed.stake === "number" && Number.isFinite(parsed.stake) && parsed.stake >= 0) {
          setStake(parsed.stake);
        }
      }
    } catch {
      /* ignore a bad local value */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify({ currency, stake }));
  }, [currency, stake, ready]);

  return { currency, setCurrency, stake, setStake };
}
