import React from 'react';

export function CaptureButton() {
  return (
    <button type="button" className="capture-button">
      <span className="capture-button__glow" aria-hidden />
      <span className="capture-button__icon" aria-hidden>
        📸
      </span>
      <span className="capture-button__text">
        Prova de captura
        <small>imagem + assinatura viva</small>
      </span>
    </button>
  );
}
