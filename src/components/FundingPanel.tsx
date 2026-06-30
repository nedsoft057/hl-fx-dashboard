import type { FxMarket } from "../types";

interface FundingPanelProps {
  markets: FxMarket[];
}

export function FundingPanel({ markets }: FundingPanelProps) {
  const ranked = [...markets].sort((a, b) => a.funding - b.funding).slice(0, 8);

  return (
    <section className="panel">
      <header className="panel__head">
        <h2>Funding leaders</h2>
        <span className="panel__sub">most negative first</span>
      </header>
      <ul className="rank-list">
        {ranked.map((m, i) => (
          <li key={m.id} className="rank-list__row">
            <span className="rank-list__idx">{i + 1}</span>
            <span className="rank-list__label">{m.id}</span>
            <span
              className={
                m.funding < 0 ? "rank-list__val text-positive" : "rank-list__val text-negative"
              }
            >
              {(m.funding * 100).toFixed(4)}%
            </span>
          </li>
        ))}
        {ranked.length === 0 && <li className="rank-list__empty">No FX markets yet</li>}
      </ul>
      <p className="panel__note">
        Negative funding pays longs (shorts foot the bill); positive funding pays
        shorts. Hyperliquid settles funding hourly.
      </p>
    </section>
  );
}
