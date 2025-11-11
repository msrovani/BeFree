const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cssPath = path.join(__dirname, '..', 'apps', 'frontend', 'styles', 'globals.css');
const promptPath = path.join(__dirname, '..', 'docs', 'prompts', 'frontend-vision.md');

test('globals.css expõe a paleta holográfica do frontend', () => {
  const css = fs.readFileSync(cssPath, 'utf-8');

  assert.match(css, /--holo-primary: #38bdf8/i, 'cor primária holográfica ausente');
  assert.match(css, /--holo-violet: #8b5cf6/i, 'cor violeta holográfica ausente');
  assert.match(css, /--holo-emerald: #22c55e/i, 'cor esmeralda holográfica ausente');
  assert.match(css, /--holo-gold: #fbbf24/i, 'cor dourada holográfica ausente');
  assert.match(css, /--jarbas-aura:/i, 'variável de aura do Jarbas ausente');
  assert.match(css, /@keyframes breathe/i, 'animação breathe ausente');
});

test('prompt de design V2 está documentado', () => {
  const prompt = fs.readFileSync(promptPath, 'utf-8');

  assert.match(prompt, /MEGA PROMPT — "Design BeFree UI v2/i, 'título do mega prompt não encontrado');
  assert.match(prompt, /Tema Dark Elegante e Neo-Orgânico/i, 'seção de estilo ausente');
  assert.match(prompt, /Stack Recomendado/i, 'stack recomendado não documentado');
});
