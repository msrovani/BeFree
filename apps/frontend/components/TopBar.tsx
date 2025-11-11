'use client';

import React from 'react';

import { useWallet } from '../hooks/useWallet';
import type { CommunitySummary } from '../lib/demoData';

const items = [
  { label: 'Feed', icon: '📡', hint: 'Rede viva' },
  { label: 'Círculos', icon: '💬', hint: 'Conexões íntimas' },
  { label: 'JARBAS', icon: '🧠', hint: 'IA pessoal' },
  { label: 'BFR', icon: '🪙', hint: 'Economia reputacional' },
  { label: 'Perfil', icon: '👤', hint: 'Sua aura' },
];

interface TopBarProps {
  summary: CommunitySummary;
}

export function TopBar({ summary }: TopBarProps) {
  const wallet = useWallet();

  return (
    <header className="topbar">
      <div className="topbar__brand" aria-label="Identidade BeFree">
        <span className="topbar__icon" aria-hidden>
          🕊️
        </span>
        <div className="topbar__brandCopy">
          <strong>BEFREE</strong>
          <span className="topbar__subtitle">liberdade digital · IA empática · reputação viva</span>
        </div>
      </div>
      <nav className="topbar__nav" aria-label="Navegação principal">
        {items.map((item) => (
          <button key={item.label} type="button" className="topbar__navItem">
            <span className="topbar__navIcon" aria-hidden>
              {item.icon}
            </span>
            <span>
              {item.label}
              <small>{item.hint}</small>
            </span>
          </button>
        ))}
      </nav>
      <div className="topbar__summary" aria-live="polite">
        <span className="topbar__summaryDigest">{summary.digestSummary}</span>
        <span className="topbar__summaryStats">
          {summary.totals.published} pulsos · {summary.totals.uniqueAuthors} autores · host {summary.host}
        </span>
      </div>
      <div className="topbar__wallet">
        {wallet.connected ? (
          <button type="button" onClick={wallet.disconnect} className="topbar__walletButton connected">
            <span className="dot" />
            {wallet.address}
          </button>
        ) : (
          <button type="button" onClick={wallet.connect} className="topbar__walletButton">
            Conectar carteira
          </button>
        )}
        <span className="topbar__network">{wallet.network}</span>
      </div>
    </header>
  );
}
