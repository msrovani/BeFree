const test = require('node:test');
const assert = require('node:assert/strict');

const {
  runScenario,
  createSampleScenario,
  CommunitySimulator,
  runScenarioWithOrchestrator,
  canRunOrchestratorParity,
} = require('../packages/cli/simulator');

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
});

test('relatório inclui estatísticas por ator e destaque de participantes', async () => {
  const actorScenario = {
    name: 'Participantes ativos',
    participants: [{ id: 'aliado', label: 'Aliado Local' }],
    steps: [
      {
        label: 'Conteúdo recebido',
        action: {
          type: 'ingest',
          participantId: 'aliado',
          manifest: {
            title: 'Relato de campo',
            tags: ['relato', 'campo'],
            evidence: { creationUnix: Date.now(), cid: 'aliado-relato' },
          },
          body: 'Atualização direta do campo após assembleia descentralizada.',
        },
      },
      {
        label: 'Abertura de proposta',
        action: {
          type: 'proposal',
          draft: {
            title: 'Priorizar recursos comunitários',
            description: 'Definir próximos focos de investimento cooperado.',
            options: [{ label: 'Educação popular' }, { label: 'Rede de cuidados' }],
          },
          activate: true,
          autoVote: { participantId: 'aliado', choiceIndex: 1 },
        },
      },
      {
        label: 'Voto complementar',
        action: { type: 'vote', participantId: 'aliado', choiceIndex: 0 },
      },
      {
        label: 'Digest rápido',
        action: { type: 'digest' },
      },
    ],
  };

  const report = await runScenario(actorScenario);

  assert.ok(Array.isArray(report.actors));
  assert.ok(report.actors.length >= 2);

  const host = report.actors.find((actor) => actor.role === 'host');
  assert.ok(host);
  assert.equal(host.stats.proposals, 1);
  assert.equal(host.stats.digests, 1);

  const ally = report.actors.find((actor) => actor.id === 'aliado');
  assert.ok(ally);
  assert.equal(ally.stats.ingested, 1);
  assert.equal(ally.stats.votes, 2);

  assert.ok(Array.isArray(report.participants));
  const participantEntry = report.participants.find((entry) => entry.id === 'aliado');
  assert.ok(participantEntry);
  assert.equal(participantEntry.stats.ingested, 1);
});

if (!canRunOrchestratorParity()) {
  test.skip('simulador CLI mantém paridade de métricas com o orquestrador TypeScript', () => {});
} else {
  test('simulador CLI mantém paridade de métricas com o orquestrador TypeScript', async () => {
    const sample = createSampleScenario();
    const cliReport = await runScenario(sample, { iterations: 2 });
    const orchestratorRun = await runScenarioWithOrchestrator(sample, { iterations: 2 });
    const orchestratorReport = orchestratorRun.report;

    const metrics = new Set([
      ...Object.keys(cliReport.stats ?? {}),
      ...Object.keys(orchestratorReport.stats ?? {}),
    ]);

    for (const metric of metrics) {
      assert.equal(cliReport.stats[metric], orchestratorReport.stats[metric], `Métrica divergente: ${metric}`);
    }

    assert.equal(cliReport.proposals.length, orchestratorReport.proposals.length);
    assert.equal(cliReport.participants.length, orchestratorReport.participants.length);
  });
}
