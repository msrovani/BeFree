import React, { useCallback } from 'react';

import { VoiceInput } from './VoiceInput';
import { CaptureButton } from './CaptureButton';
import { useSonicFeedback } from '../hooks/useSonicFeedback';

export function ActionDock() {
  const { trigger, arm, isSupported } = useSonicFeedback();

  const handleNewPulse = useCallback(() => {
    void trigger('publish');
  }, [trigger]);

  const handleCircle = useCallback(() => {
    void trigger('burn');
  }, [trigger]);

  return (
    <section className="action-dock" onMouseEnter={() => void arm()} onTouchStart={() => void arm()}>
      <VoiceInput />
      <button type="button" className="action-dock__button primary" onClick={handleNewPulse}>
        <span>+ Novo pulse</span>
      </button>
      <CaptureButton />
      <button type="button" className="action-dock__button subtle" onClick={handleCircle}>
        🔒 Círculo fechado
      </button>
      {isSupported ? null : (
        <span className="action-dock__hint">Seu navegador não suporta feedback sonoro experimental.</span>
      )}
    </section>
  );
}
