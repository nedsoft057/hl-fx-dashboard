import { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";
import type { Candle, ConnectionStatus, FillEvent, FxMarket } from "./types";
import { discoverFxMarkets, refreshFxMarkets } from "./lib/hyperliquidInfo";
import {
  chunk,
  getGoldRushClient,
  hasApiKey,
  subscribeOhlcvBatch,
  subscribeWalletFills,
} from "./lib/goldrush";
import { FxCard } from "./components/FxCard";
import { FundingPanel } from "./components/FundingPanel";
import { VolumePanel } from "./components/VolumePanel";
import { FillsFeed } from "./components/FillsFeed";

const BATCH_SIZE = 5;
const META_REFRESH_MS = 30_000;
const MAX_CANDLES = 60;
const MAX_FILLS = 60;

export default function App() {
  const [markets, setMarkets] = useState<FxMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [candlesByPair, setCandlesByPair] = useState<Record<string, Candle[]>>(
    {}
  );
  const [streamStatus, setStreamStatus] = useState<ConnectionStatus>("idle");
  const [wallets, setWallets] = useState<string[]>([]);
  const [fills, setFills] = useState<FillEvent[]>([]);

  const marketsRef = useRef<FxMarket[]>([]);
  marketsRef.current = markets;

  // 1. Discover HIP-3 + canonical FX markets via the Hyperliquid info API.
  useEffect(() => {
    let cancelled = false;
    discoverFxMarkets()
      .then((found) => {
        if (cancelled) return;
        setMarkets(found);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setDiscoveryError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Poll meta/asset ctxs to keep funding, OI, volume and markPx fresh.
  useEffect(() => {
    if (markets.length === 0) return;
    const id = setInterval(async () => {
      try {
        const updates = await refreshFxMarkets(marketsRef.current);
        setMarkets((prev) =>
          prev.map((m) => {
            const u = updates.get(m.id);
            return u ? { ...m, ...u } : m;
          })
        );
      } catch {
        // ignore transient refresh failures, streaming keeps prices live
      }
    }, META_REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets.length > 0]);

  // 3. Subscribe to live OHLCV candles for every discovered FX pair, batched
  //    in groups of 5 pair addresses per GoldRush subscription call.
  useEffect(() => {
    if (!hasApiKey() || markets.length === 0) return;
    const client = getGoldRushClient(setStreamStatus);
    const pairAddresses = markets.map((m) => m.pairAddress);
    const batches = chunk(pairAddresses, BATCH_SIZE);
    const unsubscribers = batches.map((batch) =>
      subscribeOhlcvBatch(
        client,
        batch,
        (pairAddress, bar) => {
          setCandlesByPair((prev) => {
            const existing = prev[pairAddress] ?? [];
            const last = existing[existing.length - 1];
            const next =
              last && last.t === bar.t
                ? [...existing.slice(0, -1), bar]
                : [...existing, bar].slice(-MAX_CANDLES);
            return { ...prev, [pairAddress]: next };
          });
        },
        setStreamStatus
      )
    );
    return () => unsubscribers.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets.map((m) => m.pairAddress).join("|")]);

  // 4. Subscribe to watched-wallet activity, filtered to discovered FX coins.
  const fxMarketIds = useMemo(() => new Set(markets.map((m) => m.id)), [
    markets,
  ]);

  useEffect(() => {
    if (!hasApiKey() || wallets.length === 0 || markets.length === 0) return;
    const client = getGoldRushClient(setStreamStatus);
    const unsubscribe = subscribeWalletFills(
      client,
      wallets,
      fxMarketIds,
      (fill) => {
        setFills((prev) => [fill, ...prev].slice(0, MAX_FILLS));
      },
      setStreamStatus
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets.join(","), markets.length > 0]);

  if (!hasApiKey()) {
    return (
      <div className="key-required">
        <h1>API key required</h1>
        <p>
          Set <code>VITE_GOLDRUSH_API_KEY</code> in a <code>.env</code> file at
          the project root and restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>HyperCore FX</h1>
          <p>Live HIP-3 builder-deployed FX perps, streamed via GoldRush</p>
        </div>
        <div className="app__status">
          <span className={`status-dot status-dot--${streamStatus}`} />
          <span>{streamStatus}</span>
        </div>
      </header>

      {discoveryError && (
        <div className="banner banner--error">
          Failed to discover markets: {discoveryError}
        </div>
      )}

      {loading ? (
        <div className="loading">Discovering HIP-3 FX markets…</div>
      ) : markets.length === 0 ? (
        <div className="loading">
          No FX markets found among current HIP-3 deployments.
        </div>
      ) : (
        <div className="layout">
          <div className="layout__cards">
            {markets.map((m) => (
              <FxCard
                key={m.id}
                market={m}
                candles={candlesByPair[m.pairAddress] ?? []}
                status={streamStatus}
              />
            ))}
          </div>
          <div className="layout__side">
            <FundingPanel markets={markets} />
            <VolumePanel markets={markets} />
            <FillsFeed
              wallets={wallets}
              onAddWallet={(addr) =>
                setWallets((prev) =>
                  prev.includes(addr) ? prev : [...prev, addr]
                )
              }
              onRemoveWallet={(addr) =>
                setWallets((prev) => prev.filter((w) => w !== addr))
              }
              fills={fills}
            />
          </div>
        </div>
      )}
    </div>
  );
}
