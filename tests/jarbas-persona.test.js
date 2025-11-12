const test = require('node:test');
const assert = require('node:assert/strict');

let personaExports;
let runtimeAvailable = true;

try {
  require('ts-node/register');
  personaExports = require('../sdk/ai/jarbasPersona.ts');
} catch (error) {
  runtimeAvailable = false;
}

if (!runtimeAvailable) {
  test.skip('Jarbas persona helpers indisponíveis sem ts-node', () => {});
} else {
  const {
    JARBAS_PERSONA,
    defaultJarbasMemory,
    buildJarbasSystemPrompt,
    validateJarbasResponse,
    registerJarbasResponse,
  } = personaExports;

  test('buildJarbasSystemPrompt inclui missão, processo e constraints', () => {
    const prompt = buildJarbasSystemPrompt({ memory: defaultJarbasMemory });
    assert.match(prompt, /Você é JARBAS/i);
    assert.match(prompt, /Missão:/);
    assert.match(prompt, /Processo interno obrigatório/);
    assert.match(prompt, /NUNCA:/);
    assert.match(prompt, /SEMPRE:/);
  });

  test('validateJarbasResponse limita tamanho e repetição', () => {
    const memory = registerJarbasResponse(defaultJarbasMemory, 'Saudação discreta.');
    const repeated = validateJarbasResponse('Saudação discreta.', memory);
    assert.ok(!repeated.valid);
    assert.ok(repeated.violations.includes('Repete frase recente.'));

    const longText = Array.from({ length: 320 }).fill('palavra').join(' ');
    const result = validateJarbasResponse(longText, defaultJarbasMemory);
    assert.ok(!result.valid);
    assert.ok(result.violations.includes('Excede 300 palavras.'));
  });

  test('persona mantém traços e compromissos definidos', () => {
    assert.ok(Array.isArray(JARBAS_PERSONA.traits) && JARBAS_PERSONA.traits.includes('humor refinado'));
    assert.ok(JARBAS_PERSONA.commitments.never.length >= 3);
    assert.ok(JARBAS_PERSONA.commitments.always.length >= 3);
  });
}
