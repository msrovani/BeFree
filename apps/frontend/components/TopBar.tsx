'use client';

import React from 'react';

import { useWallet } from '../hooks/useWallet';
import type { CommunitySummary } from '../lib/demoData';

const items = [
  { label: 'JARBAS', icon: '🧠' },
  { label: 'Feed', icon: '📡' },
  { label: 'Círculos', icon: '💬' },
  { label: 'Recompensas', icon: '💎' },
  { label: 'Perfil', icon: '👤' },
  { label: 'Configurações', icon: '⚙️' },
];

interface TopBarProps {
  summary: CommunitySummary;
}

export function TopBar({ summary }: TopBarProps) {
  const wallet = useWallet();

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__icon">🕊️</span>
        <div>
          <strong>BEFREE</strong>
          <span className="topbar__subtitle">livre para ser, falar, criar</span>
        </div>
      </div>
      <nav className="topbar__nav" aria-label="Navegação principal">
        {items.map((item) => (
          <button key={item.label} type="button" className="topbar__navItem">
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="topbar__summary" aria-live="polite">
        <span className="topbar__summaryDigest">{summary.digestSummary}</span>
        <span className="topbar__summaryStats">
          {summary.totals.published} pulses · {summary.totals.uniqueAuthors} autores · host {summary.host}
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
