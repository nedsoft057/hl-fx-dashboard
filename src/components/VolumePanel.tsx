import type { FxMarket } from "../types";

interface VolumePanelProps {
  markets: FxMarket[];
}

function formatCompact(v: number) {
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(v);
}

export function VolumePanel({ markets }: VolumePanelProps) {
  const ranked = [...markets]
    .sort((a, b) => b.dayNtlVlm - a.dayNtlVlm)
    .slice(0, 8);

  return (
    <section className="panel">
      <header className="panel__head">
        <h2>Volume leaders</h2>
        <span className="panel__sub">24h notional</span>
      </header>
      <ul className="rank-list">
        {ranked.map((m, i) => (
          <li key={m.id} className="rank-list__row">
            <span className="rank-list__idx">{i + 1}</span>
            <span className="rank-list__label">{m.id}</span>
            <span className="rank-list__val">${formatCompact(m.dayNtlVlm)}</span>
          </li>
        ))}
        {ranked.length === 0 && <li className="rank-list__empty">No FX markets yet</li>}
      </ul>
    </section>
  );
}
