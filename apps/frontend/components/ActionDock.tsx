import React from 'react';

import { VoiceInput } from './VoiceInput';
import { CaptureButton } from './CaptureButton';

export function ActionDock() {
  return (
    <section className="action-dock" aria-label="Ações primárias do ecossistema">
      <VoiceInput />
      <div className="action-dock__buttons">
        <button type="button" className="action-dock__button primary">
          <span aria-hidden>✨</span>
          Emitir novo pulso
        </button>
        <CaptureButton />
        <button type="button" className="action-dock__button subtle">
          <span aria-hidden>🔒</span>
          Abrir círculo sigiloso
        </button>
      </div>
      <p className="action-dock__hint">
        JARBAS pode transformar sua voz em ação: peça para postar, remixar ou recompensar alguém.
      </p>
    </section>
  );
}
