'use client';

import React from 'react';

import { useWallet } from '../hooks/useWallet';
import type { CommunitySummary } from '../lib/demoData';

const NAV_ITEMS = [
  { label: 'Feed', icon: '🔮', hint: 'rede viva' },
  { label: 'Círculos', icon: '🌀', hint: 'confiança' },
  { label: 'JARBAS', icon: '🧠', hint: 'voz ativa' },
  { label: 'Recompensas', icon: '💎', hint: 'BFR' },
  { label: 'Perfil', icon: '👤', hint: 'aura' },
];

interface TopBarProps {
  summary: CommunitySummary;
  onOpenPreferences?: () => void;
}

export function TopBar({ summary, onOpenPreferences }: TopBarProps) {
  const wallet = useWallet();
  const timeWindowHours = Math.max(1, Math.round(summary.timeframe.windowMs / (1000 * 60 * 60)));
  const resonanceRatio = summary.totals.published + summary.totals.inbox === 0
    ? 0
    : summary.totals.published / (summary.totals.published + summary.totals.inbox);
  const resonancePercent = Math.round(resonanceRatio * 100);

  return (
    <header className="topbar" aria-live="polite">
      <div className="topbar__primary">
        <div className="topbar__brand">
          <span className="topbar__glyph" aria-hidden>
            🕊️
          </span>
          <div>
            <strong className="topbar__title">BEFREE</strong>
            <span className="topbar__subtitle">liberdade digital, IA empática ao seu lado</span>
          </div>
        </div>
        <div className="topbar__signals">
          <div className="topbar__energy" role="meter" aria-valuenow={resonancePercent} aria-valuemin={0} aria-valuemax={100}>
            <div className="topbar__energyBar" style={{ '--energy-level': `${resonancePercent}%` } as React.CSSProperties} />
            <span className="topbar__energyLabel">Sinal BFR {resonancePercent}%</span>
          </div>
          <span className="topbar__window">últimas {timeWindowHours}h · {summary.totals.uniqueAuthors} autores vibrando</span>
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
      </div>

      <div className="topbar__secondary">
        <nav className="topbar__nav" aria-label="Navegação principal">
          {NAV_ITEMS.map((item, index) => (
            <button
              key={item.label}
              type="button"
              className={`topbar__navItem ${index === 0 ? 'topbar__navItem--active' : ''}`}
            >
              <span className="topbar__navIcon" aria-hidden>
                {item.icon}
              </span>
              <span className="topbar__navContent">
                <span className="topbar__navLabel">{item.label}</span>
                <span className="topbar__navHint">{item.hint}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="topbar__digest">
          <span className="topbar__digestLabel">Digest do Jarbas</span>
          <p className="topbar__digestText">{summary.digestSummary}</p>
          <div className="topbar__digestMeta">
            <span>{summary.totals.published} pulses publicados</span>
            <span>{summary.totals.inbox} aguardando curadoria</span>
            <span>host {summary.host}</span>
          </div>
        </div>
        <button type="button" className="topbar__preferences" onClick={onOpenPreferences}>
          🎛️ Atmosfera
        </button>
      </div>
    </header>
  );
}
