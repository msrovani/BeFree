import React from 'react';

import { VoiceInput } from './VoiceInput';
import { CaptureButton } from './CaptureButton';

interface ActionDockProps {
  onOpenPreferences: () => void;
  onPulse?: () => void;
}

export function ActionDock({ onOpenPreferences, onPulse }: ActionDockProps) {
  return (
    <section className="action-dock">
      <div className="action-dock__voice">
        <VoiceInput onPulse={onPulse} />
      </div>
      <div className="action-dock__buttons">
        <button type="button" className="action-dock__button primary" onClick={onPulse}>
          <span className="action-dock__buttonIcon" aria-hidden>
            ✨
          </span>
          <span>
            Emana novo pulse
            <small>energize a rede com sua voz</small>
          </span>
        </button>
        <CaptureButton />
        <button type="button" className="action-dock__button ghost">
          <span className="action-dock__buttonIcon" aria-hidden>
            🛡️
          </span>
          <span>
            Círculo íntimo
            <small>ativar espaço cifrado</small>
          </span>
        </button>
        <button type="button" className="action-dock__button subtle" onClick={onOpenPreferences}>
          <span className="action-dock__buttonIcon" aria-hidden>
            🎛️
          </span>
          <span>
            Personalizar atmosfera
            <small>sons, temas e filtros</small>
          </span>
        </button>
      </div>
    </section>
  );
}
