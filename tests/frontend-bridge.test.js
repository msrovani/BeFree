const test = require('node:test');
const assert = require('node:assert/strict');

let loadCommunitySnapshot;
let fallbackCommunityData;
let tsRuntimeAvailable = true;

try {
  require('ts-node/register');
  ({ loadCommunitySnapshot } = require('../apps/frontend/lib/liveCommunity.ts'));
  ({ fallbackCommunityData } = require('../apps/frontend/lib/demoData.ts'));
} catch (error) {
  tsRuntimeAvailable = false;
}

const hasContent = (value) => Array.isArray(value) && value.length > 0;

if (!tsRuntimeAvailable) {
  test.skip('loadCommunitySnapshot indisponível sem ts-node', () => {});
  test.skip('fallback de snapshot indisponível sem ts-node', () => {});
} else {
  test('loadCommunitySnapshot retorna dados vivos do orquestrador', async () => {
    const snapshot = await loadCommunitySnapshot({ iterations: 1 });

    assert.ok(hasContent(snapshot.pulses), 'espera pelo menos um pulse vivo');
    assert.ok(hasContent(snapshot.participants), 'espera participantes vivos');
    assert.ok(hasContent(snapshot.insights), 'espera insights do Jarbas');
    assert.ok(snapshot.summary.host, 'host do digest deve estar definido');
    assert.ok(snapshot.personaPrompt, 'prompt operacional deve ser gerado');
    assert.ok(snapshot.persona?.traits?.length, 'persona precisa listar traços');
    assert.ok(snapshot.jarbasMemory?.context, 'memória ativa precisa de contexto');

    const firstPulse = snapshot.pulses[0];
    assert.ok(firstPulse.summary && firstPulse.sourceDid, 'pulse deve carregar resumo e DID de origem');
  });

  test('loadCommunitySnapshot retorna fallback diante de cenários inválidos', async () => {
    const invalidScenario = {
      name: 'quebra controlada',
      steps: [
        {
          label: 'ação inválida',
          action: { type: 'desconhecido' },
        },
      ],
    };

    const snapshot = await loadCommunitySnapshot({ scenario: invalidScenario });

    assert.deepEqual(snapshot, fallbackCommunityData);
    assert.ok(snapshot.personaPrompt.includes('Você é JARBAS'), 'prompt padrão preservado');
  });
}
