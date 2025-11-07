import React from 'react';

import { VoiceInput } from './VoiceInput';
import { CaptureButton } from './CaptureButton';

export function ActionDock() {
  return (
    <section className="action-dock">
      <VoiceInput />
      <button type="button" className="action-dock__button primary">
        <span>+ Novo pulse</span>
      </button>
      <CaptureButton />
      <button type="button" className="action-dock__button subtle">
        🔒 Círculo fechado
      </button>
    </section>
  );
}
