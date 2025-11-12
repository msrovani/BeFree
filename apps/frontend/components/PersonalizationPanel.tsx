'use client';

import React, { useEffect } from 'react';

import {
  usePersonalization,
  type FeedFilterPreference,
  type MotionPreference,
  type ThemePreference,
  type TtsPreference,
} from '../hooks/usePersonalization';

interface PersonalizationPanelProps {
  open: boolean;
  onClose: () => void;
  onPreviewTone?: (event: 'insight' | 'acao' | 'recompensa') => void;
}

const THEME_LABEL: Record<ThemePreference, string> = {
  neo: 'Neo-orgânico',
  sol: 'Sol nascente',
  noir: 'Noir etéreo',
};

const MOTION_LABEL: Record<MotionPreference, string> = {
  alto: 'Imersão total',
  medio: 'Fluxo suave',
  reduzido: 'Movimento sutil',
};

const FILTER_LABEL: Record<FeedFilterPreference, string> = {
  todos: 'Todos os pulsos',
  circulos: 'Apenas círculos',
  curadoria: 'Curadoria do Jarbas',
};

const TTS_LABEL: Record<TtsPreference, string> = {
  auto: 'Narrativa contínua',
  respostas: 'Apenas respostas',
  off: 'Silenciar voz',
};

export function PersonalizationPanel({ open, onClose, onPreviewTone }: PersonalizationPanelProps) {
  const { preferences, setPreference, resetPreferences } = usePersonalization();

  if (!open) return null;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="personalization" role="dialog" aria-modal="true" aria-label="Personalização sensorial">
      <div className="personalization__content">
        <header className="personalization__header">
          <h2>Personalize a atmosfera</h2>
          <p>Escolha como a BeFree vibra para você — estética, movimento, som e voz.</p>
        </header>

        <section className="personalization__section">
          <h3>Tema</h3>
          <div className="personalization__options">
            {(Object.keys(THEME_LABEL) as ThemePreference[]).map((theme) => (
              <button
                key={theme}
                type="button"
                className={`personalization__option ${preferences.theme === theme ? 'is-active' : ''}`}
                onClick={() => setPreference('theme', theme)}
              >
                <span className="personalization__optionLabel">{THEME_LABEL[theme]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="personalization__section">
          <h3>Movimento</h3>
          <div className="personalization__options">
            {(Object.keys(MOTION_LABEL) as MotionPreference[]).map((motion) => (
              <button
                key={motion}
                type="button"
                className={`personalization__option ${preferences.motion === motion ? 'is-active' : ''}`}
                onClick={() => setPreference('motion', motion)}
              >
                <span className="personalization__optionLabel">{MOTION_LABEL[motion]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="personalization__section">
          <h3>Som e vibração</h3>
          <div className="personalization__toggles">
            <label>
              <input
                type="checkbox"
                checked={preferences.soundscape}
                onChange={(event) => setPreference('soundscape', event.target.checked)}
              />
              Ativar trilha sensorial
            </label>
            <label>
              <input
                type="checkbox"
                checked={preferences.haptics}
                onChange={(event) => setPreference('haptics', event.target.checked)}
              />
              Vibração tátil
            </label>
            <label>
              <input
                type="range"
                min="0"
                max="1"
                step="1"
                value={preferences.ambientVolume === 'imersivo' ? 1 : 0}
                onChange={(event) => setPreference('ambientVolume', event.target.value === '1' ? 'imersivo' : 'suave')}
              />
              Intensidade sonora ({preferences.ambientVolume === 'imersivo' ? 'imersiva' : 'suave'})
            </label>
            <div className="personalization__previewButtons">
              <button type="button" onClick={() => onPreviewTone?.('insight')}>
                Pré-escutar insight
              </button>
              <button type="button" onClick={() => onPreviewTone?.('acao')}>
                Pré-escutar ação
              </button>
              <button type="button" onClick={() => onPreviewTone?.('recompensa')}>
                Pré-escutar recompensa
              </button>
            </div>
          </div>
        </section>

        <section className="personalization__section">
          <h3>Voz do Jarbas</h3>
          <div className="personalization__options personalization__options--compact">
            {(Object.keys(TTS_LABEL) as TtsPreference[]).map((option) => (
              <button
                key={option}
                type="button"
                className={`personalization__option ${preferences.tts === option ? 'is-active' : ''}`}
                onClick={() => setPreference('tts', option)}
              >
                <span className="personalization__optionLabel">{TTS_LABEL[option]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="personalization__section">
          <h3>Filtro do feed</h3>
          <div className="personalization__options personalization__options--compact">
            {(Object.keys(FILTER_LABEL) as FeedFilterPreference[]).map((filter) => (
              <button
                key={filter}
                type="button"
                className={`personalization__option ${preferences.feedFilter === filter ? 'is-active' : ''}`}
                onClick={() => setPreference('feedFilter', filter)}
              >
                <span className="personalization__optionLabel">{FILTER_LABEL[filter]}</span>
              </button>
            ))}
          </div>
        </section>

        <footer className="personalization__footer">
          <button type="button" className="personalization__reset" onClick={resetPreferences}>
            Restaurar atmosfera padrão
          </button>
          <button type="button" className="personalization__close" onClick={onClose}>
            Concluir
          </button>
        </footer>
      </div>
    </div>
  );
}
