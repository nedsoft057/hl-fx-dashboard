// Currency codes we treat as "FX" symbols on HIP-3 dexes.
export const FX_CODES = ["JPY", "EUR", "GBP", "CHF", "AUD", "CAD"] as const;
export type FxCode = (typeof FX_CODES)[number];

// A single HIP-3 (or canonical) perp market as discovered from the
// Hyperliquid /info endpoint (perpDexs + metaAndAssetCtxs).
export interface FxMarket {
  /** Market id used everywhere in the UI, e.g. "xyz:JPY" */
  id: string;
  /** Deployer / DEX short name, "" for the canonical first perp dex */
  dex: string;
  /** Human full name of the dex, e.g. "xyz perps" */
  dexFullName: string;
  /** Bare coin symbol, e.g. "JPY" */
  symbol: string;
  /** GoldRush streaming pair address, e.g. "xyz:JPY-USDC" */
  pairAddress: string;
  szDecimals: number;
  markPx: number;
  prevDayPx: number;
  dayNtlVlm: number;
  openInterest: number;
  /** Signed hourly funding rate (fraction, e.g. 0.0000125 = 0.00125%) */
  funding: number;
}

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface FillEvent {
  key: string;
  marketId: string;
  coin: string;
  side: "B" | "A" | string;
  price: number;
  size: number;
  time: number;
  wallet: string;
  hash: string;
  builder?: string | null;
}

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "error";
