#!/usr/bin/env node
const { mkdirSync, readFileSync, writeFileSync, existsSync } = require('fs');
const { join, resolve, isAbsolute, dirname } = require('path');

const { createIdentity } = require('./lib/identity');
const { runScenario, createSampleScenario } = require('./simulator');

const DATA_DIR = join(process.env.HOME ?? process.cwd(), '.befree');
const IDENTITY_FILE = join(DATA_DIR, 'identity.json');
const LEDGER_FILE = join(DATA_DIR, 'ledger.json');
const SIMULATION_STATE_FILE = join(DATA_DIR, 'simulation-state.json');

const PRESET_FILES = {
  'community-sprint': join(__dirname, '..', 'docs', 'samples', 'community-sprint.json'),
  'p2p-sync': join(__dirname, '..', 'docs', 'samples', 'p2p-sync.json'),
};

const ensureDataDir = () => {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadIdentity = () => {
  if (!existsSync(IDENTITY_FILE)) return undefined;
  return JSON.parse(readFileSync(IDENTITY_FILE, 'utf-8'));
};

const saveIdentity = (identity) => {
  ensureDataDir();
  writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));
};

const loadLedger = () => {
  if (!existsSync(LEDGER_FILE)) return [];
  return JSON.parse(readFileSync(LEDGER_FILE, 'utf-8'));
};

const saveLedger = (ledger) => {
  ensureDataDir();
  writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
};

const loadSimulationState = (filePath = SIMULATION_STATE_FILE) => {
  const absolute = toAbsolutePath(filePath);
  if (!existsSync(absolute)) return undefined;
  const parsed = JSON.parse(readFileSync(absolute, 'utf-8'));
  if (parsed && typeof parsed === 'object') {
    return parsed.state ?? parsed;
  }
  return undefined;
};

const saveSimulationState = (state, filePath = SIMULATION_STATE_FILE, metadata = {}) => {
  ensureDataDir();
  const payload = {
    savedAt: new Date().toISOString(),
    state,
    ...metadata,
  };
  writeFileSync(toAbsolutePath(filePath), JSON.stringify(payload, null, 2));
};

const recordTransfer = (from, to, amount, memo) => {
  const ledger = loadLedger();
  ledger.push({
    tx: `0x${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`,
    from,
    to,
    amount: Number(amount),
    memo,
    timestamp: new Date().toISOString(),
  });
  saveLedger(ledger);
  return ledger[ledger.length - 1];
};

const format = (value) => JSON.stringify(value, null, 2);

const toAbsolutePath = (value) => (isAbsolute(value) ? value : resolve(process.cwd(), value));

const parseListFlag = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => String(entry).split(',')).map((entry) => entry.trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const parseArgVector = (vector) => {
  const positional = [];
  const flags = {};
  for (let index = 0; index < vector.length; index += 1) {
    const token = vector[index];
    if (typeof token === 'string' && token.startsWith('--')) {
      const key = token.slice(2);
      const next = vector[index + 1];
      if (typeof next === 'string' && !next.startsWith('--')) {
        flags[key] = next;
        index += 1;
      } else {
        flags[key] = true;
      }
    } else if (token !== undefined) {
      positional.push(token);
    }
  }
  return { positional, flags };
};

const loadScenarioFromFile = (filePath) => {
  const absolute = toAbsolutePath(filePath);
  if (!existsSync(absolute)) {
    throw new Error(`Cenário não encontrado: ${filePath}`);
  }
  if (absolute.endsWith('.json')) {
    return JSON.parse(readFileSync(absolute, 'utf-8'));
  }
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const loaded = require(absolute);
  const scenario = loaded.default ?? loaded.scenario ?? loaded;
  return typeof scenario === 'function' ? scenario() : scenario;
};

const loadPresetScenario = (name) => {
  if (!name) return undefined;
  if (name === 'sample' || name === 'amostra') {
    return createSampleScenario();
  }
  const presetPath = PRESET_FILES[name];
  if (presetPath && existsSync(presetPath)) {
    return JSON.parse(readFileSync(presetPath, 'utf-8'));
  }
  return undefined;
};

const findActorByQuery = (actors, query) => {
  return actors.find(
    (actor) => actor.id === query || actor.did === query || (actor.label && actor.label === query)
  );
};

const command = process.argv[2];
const args = process.argv.slice(3);

const commands = {
  'identity:create': () => {
    const label = args[0];
    const identity = createIdentity(label);
    saveIdentity(identity);
    console.log(format({ message: 'Identidade criada', identity }));
  },
  'identity:show': () => {
    const identity = loadIdentity();
    if (!identity) {
      console.error('Nenhuma identidade encontrada. Rode `befree identity:create`.');
      process.exit(1);
    }
    console.log(format(identity));
  },
  'ledger:transfer': () => {
    const { positional } = parseArgVector(args);
    const [from, to, amount, memo] = positional;
    if (!from || !to || !amount) {
      console.error('Uso: befree ledger:transfer <from> <to> <amount> [memo]');
      process.exit(1);
    }
    const receipt = recordTransfer(from, to, amount, memo);
    console.log(format({ message: 'Transferência registrada', receipt }));
  },
  'ledger:history': () => {
    const ledger = loadLedger();
    console.log(format({ total: ledger.length, entries: ledger }));
  },
  'simulation:run': async () => {
    const { positional, flags } = parseArgVector(args);
    if (flags['list-presets']) {
      const presets = ['sample', ...Object.keys(PRESET_FILES)];
      console.log(format({ presets }));
      return;
    }

    const reference = flags.preset ?? positional[0];
    const scenario = (() => {
      const preset = loadPresetScenario(reference);
      if (preset) {
        return preset;
      }
      if (!reference) {
        return createSampleScenario();
      }
      return loadScenarioFromFile(reference);
    })();

    if (!scenario || typeof scenario !== 'object' || !Array.isArray(scenario.steps)) {
      throw new Error('Cenário inválido: defina um objeto com `steps`.');
    }

    const iterations = flags.iterations ? Number.parseInt(flags.iterations, 10) : 1;
    if (!Number.isFinite(iterations) || iterations < 1) {
      throw new Error('O parâmetro --iterations deve ser um número inteiro >= 1.');
    }

    const delayMultiplier = flags.delay ? Number.parseFloat(flags.delay) : undefined;
    if (flags.delay && !Number.isFinite(delayMultiplier)) {
      throw new Error('O parâmetro --delay deve ser um número válido.');
    }

    const stateFile = flags.state ? toAbsolutePath(flags.state) : SIMULATION_STATE_FILE;
    const initialState = flags.reset ? undefined : loadSimulationState(stateFile);

    const report = await runScenario(scenario, {
      iterations,
      delayMultiplier,
      verbose: Boolean(flags.verbose || flags.logs),
      simulatorOptions: { state: initialState },
    });

    let savedLogPath;
    if (flags['log-file']) {
      const target = toAbsolutePath(flags['log-file']);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, JSON.stringify(report.logs, null, 2));
      savedLogPath = target;
    }

    const highlightQueries = parseListFlag(flags.participants ?? flags.participant);
    const highlights = highlightQueries.map((query) => {
      const actor = findActorByQuery(report.actors ?? [], query);
      if (!actor) {
        return { query, found: false };
      }
      return {
        query,
        found: true,
        actor,
      };
    });

    if (!flags['no-persist']) {
      saveSimulationState(report.state, stateFile, {
        scenario: report.scenario,
        iterations: report.iterations,
        stats: report.stats,
      });
    }

    if (flags.json) {
      const enriched = {
        ...report,
        stateFile,
        persisted: !flags['no-persist'],
        restored: Boolean(initialState),
        highlights,
        logFile: savedLogPath,
      };
      console.log(format(enriched));
      return;
    }

    const summary = {
      scenario: report.scenario,
      iterations: report.iterations,
      durationMs: report.finishedAt - report.startedAt,
      participants: report.participants.length,
      proposals: report.proposals.length,
      stats: report.stats,
      atores: (report.actors ?? []).length,
      restoredState: Boolean(initialState),
      persistedState: flags['no-persist'] ? false : stateFile,
    };

    const recentLogs = report.logs
      .slice(Math.max(0, report.logs.length - 5))
      .map((entry) => ({
        iteration: entry.iteration,
        step: entry.index,
        action: entry.action.type,
        label: entry.label,
        error: entry.error,
      }));

    const errorDetails = report.logs
      .filter((entry) => entry.error)
      .map((entry) => ({
        iteration: entry.iteration,
        step: entry.index,
        label: entry.label,
        error: entry.error,
      }));

    const destaqueEncontrado = highlights
      .filter((entry) => entry.found)
      .map((entry) => ({
        id: entry.actor.id,
        role: entry.actor.role,
        label: entry.actor.label,
        stats: entry.actor.stats,
      }));

    const destaqueNaoEncontrado = highlights.filter((entry) => !entry.found).map((entry) => entry.query);

    console.log(
      format({
        message: 'Simulação concluída',
        summary,
        erros: errorDetails.length,
        errosDetalhados: errorDetails.slice(0, 5),
        ultimosPassos: recentLogs,
        destaques: destaqueEncontrado,
        destaquesNaoEncontrados: destaqueNaoEncontrado,
        logsSalvosEm: savedLogPath,
      })
    );
  },
  help: () => {
    console.log(
      'BEFREE CLI\n\n' +
        'Comandos disponíveis:\n' +
        '  befree identity:create [label]   Cria e salva uma identidade DID local\n' +
        '  befree identity:show              Mostra a identidade ativa\n' +
        '  befree ledger:transfer ...        Registra uma transferência manual\n' +
        '  befree ledger:history             Lista as transferências registradas\n' +
        '  befree simulation:run [arquivo]   Executa um cenário de simulação (padrão: sample)\n\n' +
        'Flags úteis em simulation:run\n' +
        '  --iterations <n>   Repetições do cenário (default 1)\n' +
        '  --delay <fator>    Multiplica delays do cenário\n' +
        '  --json             Exibe o relatório completo em JSON\n' +
        '  --verbose          Mostra logs de cada etapa durante a execução\n' +
        '  --state <arquivo>  Define arquivo de estado (default ~/.befree/simulation-state.json)\n' +
        '  --reset            Ignora estado salvo e inicia simulação limpa\n' +
        '  --no-persist       Não salva o estado ao final da execução\n' +
        '  --preset <nome>    Usa um preset embutido (sample, community-sprint, p2p-sync)\n' +
        '  --list-presets     Lista presets disponíveis e encerra\n' +
        '  --participants a,b Destaca participantes (id, DID ou rótulo) no relatório\n' +
        '  --log-file <path>  Exporta todos os logs da execução para um arquivo JSON\n'
    );
  },
};

if (!command || !commands[command]) {
  commands.help();
  process.exit(command ? 1 : 0);
}

Promise.resolve(commands[command]())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
