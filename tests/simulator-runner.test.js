const test = require('node:test');
const assert = require('node:assert/strict');

const { runScenario, createSampleScenario } = require('../packages/cli/simulator');

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
