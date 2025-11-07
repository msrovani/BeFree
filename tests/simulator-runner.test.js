const test = require('node:test');
const assert = require('node:assert/strict');

const { runScenario, createSampleScenario, CommunitySimulator } = require('../packages/cli/simulator');

const scenario = {
  name: 'Smoke test runner',
  steps: [
    {
      label: 'Publicação direta',
      action: {
        type: 'publish',
        manifest: {
          title: 'Atualização semanal',
          tags: ['befree', 'comunidade'],
          evidence: { creationUnix: Date.now(), cid: 'cid-simulated' },
        },
        body: 'Resumo rápido das entregas da célula comunitária.',
      },
    },
    {
      label: 'Digest imediato',
      action: { type: 'digest' },
    },
  ],
};

test('runScenario executa cenário simples sem erros', async () => {
  const report = await runScenario(scenario);

  assert.equal(report.stats.published, 1);
  assert.equal(report.stats.digests, 1);
  assert.equal(report.stats.errors, 0);
  assert.equal(report.logs.length, scenario.steps.length);
  assert.equal(report.scenario, scenario.name);
});

test('createSampleScenario retorna passos padrão', () => {
  const sample = createSampleScenario();
  assert.ok(Array.isArray(sample.steps));
  assert.ok(sample.steps.length > 0);
  assert.equal(sample.steps[0].action.type, 'publish');
});

test('estado persistido da simulação pode ser reutilizado', async () => {
  const first = await runScenario(scenario);

  assert.ok(first.state);
  assert.equal(first.state.published.length, 1);

  const second = await runScenario(scenario, { simulatorOptions: { state: first.state } });

  assert.equal(second.state.identity.did, first.state.identity.did);
  assert.equal(second.state.published.length, first.state.published.length + 1);

  const restored = new CommunitySimulator({ state: second.state });
  const snapshot = restored.snapshot();

  assert.equal(snapshot.published.length, second.state.published.length);
  assert.equal(restored.identity.did, second.state.identity.did);
  assert.ok(typeof snapshot.reputation === 'number');
  assert.ok(Array.isArray(snapshot.governance));
});
