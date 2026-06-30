import { useState } from "react";
import type { FillEvent } from "../types";

interface FillsFeedProps {
  wallets: string[];
  onAddWallet: (addr: string) => void;
  onRemoveWallet: (addr: string) => void;
  fills: FillEvent[];
}

function short(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function FillsFeed({
  wallets,
  onAddWallet,
  onRemoveWallet,
  fills,
}: FillsFeedProps) {
  const [draft, setDraft] = useState("");

  function submit() {
    const addr = draft.trim();
    if (addr.startsWith("0x") && addr.length === 42) {
      onAddWallet(addr.toLowerCase());
      setDraft("");
    }
  }

  return (
    <section className="panel">
      <header className="panel__head">
        <h2>Watched-wallet fills</h2>
        <span className="panel__sub">FX markets only</span>
      </header>

      <div className="wallet-input">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="0x… wallet to watch"
          spellCheck={false}
        />
        <button onClick={submit}>Watch</button>
      </div>

      {wallets.length > 0 && (
        <ul className="wallet-chips">
          {wallets.map((w) => (
            <li key={w} className="wallet-chip">
              {short(w)}
              <button
                aria-label={`stop watching ${w}`}
                onClick={() => onRemoveWallet(w)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <ul className="fills-feed">
        {fills.length === 0 && (
          <li className="fills-feed__empty">
            {wallets.length === 0
              ? "Add a wallet address to watch its FX fills."
              : "No FX fills yet — waiting for activity…"}
          </li>
        )}
        {fills.map((f) => (
          <li key={f.key} className="fills-feed__row">
            <span className={f.side === "B" ? "text-positive" : "text-negative"}>
              {f.side === "B" ? "BUY" : "SELL"}
            </span>
            <span className="fills-feed__coin">{f.coin}</span>
            <span className="fills-feed__px">{f.price}</span>
            <span className="fills-feed__sz">{f.size}</span>
            <span className="fills-feed__wallet">{short(f.wallet)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

