import { useEffect, useRef, useState } from "react";
import type { Candle, ConnectionStatus, FxMarket } from "../types";
import { Sparkline } from "./Sparkline";

interface FxCardProps {
  market: FxMarket;
  candles: Candle[];
  status: ConnectionStatus;
}

function formatPrice(v: number, decimals: number) {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(decimals + 1, 6),
    maximumFractionDigits: Math.min(decimals + 1, 6),
  });
}

function formatCompact(v: number) {
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(v);
}

export function FxCard({ market, candles, status }: FxCardProps) {
  const liveClose = candles.length
    ? candles[candles.length - 1].c
    : market.markPx;
  const pctChange =
    market.prevDayPx > 0
      ? ((liveClose - market.prevDayPx) / market.prevDayPx) * 100
      : 0;
  const isUp = pctChange >= 0;
  const fundingNegative = market.funding < 0;

  const prevPriceRef = useRef(liveClose);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (liveClose !== prevPriceRef.current) {
      setFlash(liveClose > prevPriceRef.current ? "up" : "down");
      prevPriceRef.current = liveClose;
      const id = setTimeout(() => setFlash(null), 650);
      return () => clearTimeout(id);
    }
  }, [liveClose]);

  return (
    <article className="fx-card">
      <header className="fx-card__head">
        <div>
          <div className="fx-card__pair">{market.id}</div>
          <div className="fx-card__dex">
            {market.dex ? market.dex : "canonical"} · {market.dexFullName}
          </div>
        </div>
        <span
          className={`status-dot status-dot--${status}`}
          title={`stream: ${status}`}
        />
      </header>

      <div className="fx-card__body">
        <div className="fx-card__price-col">
          <div className={`fx-card__price flash-${flash ?? "none"}`}>
            {formatPrice(liveClose, market.szDecimals)}
          </div>
          <div className={`fx-card__pct ${isUp ? "text-positive" : "text-negative"}`}>
            {isUp ? "▲" : "▼"} {Math.abs(pctChange).toFixed(2)}% 24h
          </div>
        </div>
        <Sparkline candles={candles} positive={isUp} />
      </div>

      <dl className="fx-card__stats">
        <div>
          <dt>24h Vol</dt>
          <dd>${formatCompact(market.dayNtlVlm)}</dd>
        </div>
        <div>
          <dt>Open Interest</dt>
          <dd>${formatCompact(market.openInterest * liveClose)}</dd>
        </div>
        <div>
          <dt>Funding (1h)</dt>
          <dd className={fundingNegative ? "text-positive" : "text-negative"}>
            {(market.funding * 100).toFixed(4)}%
          </dd>
        </div>
      </dl>

      <p className="fx-card__funding-note">
        {fundingNegative
          ? "Negative — shorts pay longs"
          : "Positive — longs pay shorts"}
      </p>
    </article>
  );
}
