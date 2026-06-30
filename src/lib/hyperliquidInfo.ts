import { FX_CODES, type FxMarket } from "../types";

const HL_INFO_URL = "https://api.hyperliquid.xyz/info";

interface PerpDexEntry {
  name: string;
  full_name?: string;
  fullName?: string;
  deployer?: string;
}

// perpDexs returns [null, {...}, {...}] — null is the canonical first perp dex.
type PerpDexsResponse = (PerpDexEntry | null)[];

interface UniverseAsset {
  name: string;
  szDecimals: number;
  maxLeverage?: number;
  onlyIsolated?: boolean;
}

interface MetaResponse {
  universe: UniverseAsset[];
}

interface AssetCtx {
  dayNtlVlm: string;
  funding: string;
  markPx: string;
  midPx?: string;
  openInterest: string;
  oraclePx?: string;
  premium?: string;
  prevDayPx: string;
}

type MetaAndAssetCtxsResponse = [MetaResponse, AssetCtx[]];

async function postInfo<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Hyperliquid /info ${body.type} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function isFxSymbol(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  return FX_CODES.some((code) => upper.includes(code));
}

/**
 * Discover every HIP-3 (+ canonical) perp market, then filter down to the
 * ones that look like FX pairs (JPY, EUR, GBP, CHF, AUD, CAD, ...).
 */
export async function discoverFxMarkets(): Promise<FxMarket[]> {
  const perpDexs = await postInfo<PerpDexsResponse>({ type: "perpDexs" });

  // Build the list of dexes to query: canonical ("") plus every named HIP-3 dex.
  const dexes: { dex: string; fullName: string }[] = [
    { dex: "", fullName: "Hyperliquid (canonical)" },
    ...perpDexs
      .filter((d): d is PerpDexEntry => d !== null && !!d.name)
      .map((d) => ({
        dex: d.name,
        fullName: d.full_name ?? d.fullName ?? d.name,
      })),
  ];

  const results = await Promise.allSettled(
    dexes.map(async ({ dex, fullName }) => {
      const body: Record<string, unknown> = { type: "metaAndAssetCtxs" };
      if (dex) body.dex = dex;
      const [meta, ctxs] = await postInfo<MetaAndAssetCtxsResponse>(body);
      const markets: FxMarket[] = [];
      meta.universe.forEach((asset, i) => {
        if (!isFxSymbol(asset.name)) return;
        const ctx = ctxs[i];
        if (!ctx) return;
        const id = dex ? `${dex}:${asset.name}` : asset.name;
        markets.push({
          id,
          dex,
          dexFullName: fullName,
          symbol: asset.name,
          pairAddress: `${id}-USDC`,
          szDecimals: asset.szDecimals,
          markPx: Number(ctx.markPx),
          prevDayPx: Number(ctx.prevDayPx),
          dayNtlVlm: Number(ctx.dayNtlVlm),
          openInterest: Number(ctx.openInterest),
          funding: Number(ctx.funding),
        });
      });
      return markets;
    })
  );

  const all: FxMarket[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  return all;
}

/**
 * Lightweight refresh of funding / OI / volume / markPx for an already
 * discovered set of markets, grouped by dex so we only re-fetch each
 * metaAndAssetCtxs payload once.
 */
export async function refreshFxMarkets(
  markets: FxMarket[]
): Promise<Map<string, Partial<FxMarket>>> {
  const dexGroups = new Map<string, { fullName: string }>();
  for (const m of markets) {
    if (!dexGroups.has(m.dex)) dexGroups.set(m.dex, { fullName: m.dexFullName });
  }

  const updates = new Map<string, Partial<FxMarket>>();

  await Promise.allSettled(
    Array.from(dexGroups.keys()).map(async (dex) => {
      const body: Record<string, unknown> = { type: "metaAndAssetCtxs" };
      if (dex) body.dex = dex;
      const [meta, ctxs] = await postInfo<MetaAndAssetCtxsResponse>(body);
      meta.universe.forEach((asset, i) => {
        const id = dex ? `${dex}:${asset.name}` : asset.name;
        const ctx = ctxs[i];
        if (!ctx) return;
        if (!markets.some((m) => m.id === id)) return;
        updates.set(id, {
          markPx: Number(ctx.markPx),
          prevDayPx: Number(ctx.prevDayPx),
          dayNtlVlm: Number(ctx.dayNtlVlm),
          openInterest: Number(ctx.openInterest),
          funding: Number(ctx.funding),
        });
      });
    })
  );

  return updates;
}
