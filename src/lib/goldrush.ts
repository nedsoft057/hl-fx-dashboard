import {
  GoldRushClient,
  StreamingChain,
  StreamingInterval,
  StreamingTimeframe,
  type OHLCVPairsStreamResponse,
  type WalletActivityStreamResponse,
} from "@covalenthq/client-sdk";
import type { Candle, ConnectionStatus, FillEvent, FxMarket } from "../types";

const API_KEY = import.meta.env.VITE_GOLDRUSH_API_KEY as string | undefined;

let client: GoldRushClient | null = null;

export function hasApiKey(): boolean {
  return !!API_KEY;
}

/** Lazily create (or reuse) the single GoldRush streaming client for the app. */
export function getGoldRushClient(onStatus: (s: ConnectionStatus) => void) {
  if (!API_KEY) {
    throw new Error("VITE_GOLDRUSH_API_KEY is missing");
  }
  if (!client) {
    client = new GoldRushClient(
      API_KEY,
      {},
      {
        onConnecting: () => onStatus("connecting"),
        onOpened: () => onStatus("open"),
        onClosed: () => onStatus("closed"),
        onError: () => onStatus("error"),
      }
    );
  }
  return client;
}

/** Split an array into chunks of `size` — used to batch pair subscriptions. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Subscribe to live 1m OHLCV candles for a batch (<=5) of FX pair addresses.
 * Returns an unsubscribe function.
 *
 * The installed @covalenthq/client-sdk types each item in the OHLCV pairs
 * stream as `OHLCVPairsStreamResponse`, which carries `pair_address` plus
 * spelled-out `open/high/low/close/volume/timestamp` fields (not the
 * shorthand o/h/l/c/v/t used in some GoldRush docs examples) — so each bar
 * is already tagged with the pair it belongs to, no guessing required.
 */
export function subscribeOhlcvBatch(
  client: GoldRushClient,
  batch: string[],
  onCandle: (pairAddress: string, bar: Candle) => void,
  onStatus: (s: ConnectionStatus) => void
): () => void {
  const unsubscribe = client.StreamingService.subscribeToOHLCVPairs(
    {
      chain_name: StreamingChain.HYPERCORE_MAINNET,
      pair_addresses: batch,
      interval: StreamingInterval.ONE_MINUTE,
      timeframe: StreamingTimeframe.ONE_HOUR,
    },
    {
      next: (rows: OHLCVPairsStreamResponse[]) => {
        for (const row of rows) {
          if (!row?.pair_address) continue;
          const t = Date.parse(row.timestamp);
          onCandle(row.pair_address, {
            t: Number.isFinite(t) ? t : Date.now(),
            o: Number(row.open),
            h: Number(row.high),
            l: Number(row.low),
            c: Number(row.close),
            v: Number(row.volume ?? 0),
          });
        }
      },
      error: () => onStatus("error"),
      complete: () => onStatus("closed"),
    }
  );
  return unsubscribe;
}

/**
 * Subscribe to live wallet activity for a list of watched addresses, only
 * forwarding HypercoreFillTransaction events whose coin matches one of the
 * discovered FX markets.
 *
 * NOTE: the `decoded_details` union shipped in this SDK version's type
 * declarations (Transfer/Swap/Bridge/Deposit/Withdraw/Approve/Error) predates
 * HyperCore-specific decoding. GoldRush's HyperCore docs document a
 * `HypercoreFillTransaction` variant (with `type`, `coin`, `side`, `price`,
 * `size`, `fee`, `time`, `builder`, ...) returned over this same stream for
 * chain_name HYPERCORE_MAINNET, so we read it defensively at runtime rather
 * than trusting the narrower compile-time union.
 */
export function subscribeWalletFills(
  client: GoldRushClient,
  walletAddresses: string[],
  fxMarketIds: Set<string>,
  onFill: (fill: FillEvent) => void,
  onStatus: (s: ConnectionStatus) => void
): () => void {
  const unsubscribe = client.StreamingService.subscribeToWalletActivity(
    {
      chain_name: StreamingChain.HYPERCORE_MAINNET,
      wallet_addresses: walletAddresses,
    },
    {
      next: (rows: WalletActivityStreamResponse[]) => {
        for (const row of rows) {
          const details = row?.decoded_details as
            | Record<string, unknown>
            | Record<string, unknown>[]
            | undefined;
          if (!details) continue;
          const detailList = Array.isArray(details) ? details : [details];
          for (const d of detailList) {
            if (d?.type !== "HypercoreFillTransaction") continue;
            const coin = d.coin as string | undefined;
            if (!coin || !fxMarketIds.has(coin)) continue;
            onFill({
              key: `${(d.hash as string) ?? ""}-${
                (d.tid as number) ?? Math.random()
              }`,
              marketId: coin,
              coin,
              side: (d.side as string) ?? "?",
              price: Number(d.price ?? 0),
              size: Number(d.size ?? 0),
              time: Number(d.time ?? Date.now()),
              wallet: row.from_address ?? "unknown",
              hash: (d.hash as string) ?? row.tx_hash ?? "",
              builder: (d.builder as string) ?? null,
            });
          }
        }
      },
      error: () => onStatus("error"),
      complete: () => onStatus("closed"),
    }
  );
  return unsubscribe;
}

export function findFxMarketByPairAddress(
  markets: FxMarket[],
  pairAddress: string
): FxMarket | undefined {
  return markets.find(
    (m) => m.pairAddress.toLowerCase() === pairAddress.toLowerCase()
  );
                      }
