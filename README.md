# HyperCore FX — HIP-3 FX Perps Dashboard

A frontend-only React 19 + Vite dashboard for live Hyperliquid HIP-3
builder-deployed FX perpetuals (JPY, EUR, GBP, CHF, AUD, CAD, …), built on
`@covalenthq/client-sdk` (GoldRush) streaming. There is no backend — market
discovery hits the public Hyperliquid `/info` REST endpoint directly from the
browser, and live data comes from GoldRush's WebSocket streaming service.

## Setup

```bash
npm install
npm run dev
```

The API key is read from `VITE_GOLDRUSH_API_KEY` in `.env` (already populated
for local development). If it's missing, the app shows "API key required."

> **Security note:** the GoldRush key for this project was shared in plain
> text in chat to get this running quickly. Treat it as already exposed —
> rotate it in the GoldRush dashboard before using this anywhere beyond local
> testing, and keep `.env` out of version control (it's already gitignored).

## How it works

1. **Market discovery** (`src/lib/hyperliquidInfo.ts`) — on load, POSTs
   `{ type: "perpDexs" }` to `https://api.hyperliquid.xyz/info` to enumerate
   every HIP-3 deployer dex, then calls `{ type: "metaAndAssetCtxs", dex }`
   for each one (plus once without `dex` for the canonical market set).
   Universe entries whose symbol contains JPY/EUR/GBP/CHF/AUD/CAD are kept as
   FX markets. Market ids follow Hyperliquid's own `{dex}:{coin}` convention
   (canonical markets have no prefix); GoldRush pair addresses are built as
   `{id}-USDC`.
2. **Live candles** (`src/lib/goldrush.ts`) — subscribes to
   `StreamingService.subscribeToOHLCVPairs` on `StreamingChain.HYPERCORE_MAINNET`
   with `StreamingInterval.ONE_MINUTE` / `StreamingTimeframe.ONE_HOUR`,
   batching pair addresses in groups of 5 per call. Used to drive each card's
   live price and sparkline.
3. **Funding / OI / volume** — refreshed every 30s by re-polling
   `metaAndAssetCtxs`, since those fields aren't part of the OHLCV stream.
4. **Watched-wallet fills** — `StreamingService.subscribeToWalletActivity`
   on the same HyperCore chain, filtered client-side to
   `HypercoreFillTransaction` events whose `coin` matches a discovered FX
   market id. Add wallet addresses from the right-hand panel.

## Layout

Dark, two-column terminal layout: FX cards on the left (price, 24h change,
volume, open interest, signed hourly funding rate, live sparkline), ranked
funding/volume panels and the wallet-fills feed on the right.

Funding sign convention (Hyperliquid, settled hourly): **negative funding
means shorts pay longs; positive funding means longs pay shorts.**
