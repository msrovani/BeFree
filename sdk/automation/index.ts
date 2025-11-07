import { randomUUID } from 'crypto';
import type {
  ContentBroadcastEnvelope,
  Proposal,
  ProposalVoteRecord,
  CommunityDigest,
} from '../platform';
import type { TransferReceipt } from '../economy';
import type { ReputationEvent } from '../reputation';

export type AutomationEvent =
  | { type: 'content:published'; envelope: ContentBroadcastEnvelope }
  | { type: 'content:received'; envelope: ContentBroadcastEnvelope; sourcePeer?: string }
  | { type: 'content:invalid'; envelope: ContentBroadcastEnvelope }
  | { type: 'governance:proposal:created'; proposal: Proposal }
  | { type: 'governance:proposal:activated'; proposal: Proposal }
  | { type: 'governance:proposal:cancelled'; proposal: Proposal }
  | { type: 'governance:proposal:closed'; proposal: Proposal }
  | { type: 'governance:proposal:voted'; vote: ProposalVoteRecord }
  | { type: 'analytics:digest'; digest: CommunityDigest }
  | { type: 'ledger:transfer'; receipt: TransferReceipt }
  | { type: 'reputation:event'; event: ReputationEvent };

export type AutomationEventType = AutomationEvent['type'];

export type AutomationFilter<E extends AutomationEvent> = (
  event: E,
  context: AutomationContext
) => boolean | Promise<boolean>;

export type AutomationHandler<E extends AutomationEvent> = (
  event: E,
  context: AutomationContext
) => void | Promise<void>;

export interface AutomationTask<TType extends AutomationEventType = AutomationEventType> {
  id?: string;
  description?: string;
  triggers: TType | TType[];
  filter?: AutomationFilter<Extract<AutomationEvent, { type: TType }>>;
  run: AutomationHandler<Extract<AutomationEvent, { type: TType }>>;
  once?: boolean;
  cooldownMs?: number;
}

export interface AutomationTaskStatus {
  id: string;
  description?: string;
  triggers: AutomationEventType[];
  runs: number;
  lastRunAt?: number;
  once?: boolean;
  cooldownMs?: number;
}

export interface AutomationJob {
  id?: string;
  description?: string;
  intervalMs: number;
  run: (context: AutomationContext) => void | Promise<void>;
  immediate?: boolean;
}

export interface RegisteredAutomationJob extends AutomationJob {
  id: string;
  runs: number;
  lastRunAt?: number;
}

export type AutomationLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AutomationLogEvent {
  level: AutomationLogLevel;
  message: string;
  taskId?: string;
  meta?: Record<string, unknown>;
  error?: unknown;
}

export interface AutomationContext {
  orchestrator?: unknown;
  emit?: (event: string, payload?: unknown) => void;
  logger?: (event: AutomationLogEvent) => void | Promise<void>;
  getState<T>(key: string): T | undefined;
  setState<T>(key: string, value: T): void;
  deleteState(key: string): void;
}

interface InternalTask extends AutomationTask {
  id: string;
  triggers: AutomationEventType[];
}

interface InternalJob extends RegisteredAutomationJob {
  handle?: NodeJS.Timeout;
}

const normalizeTriggers = (triggers: AutomationTask['triggers']) => {
  const values = Array.isArray(triggers) ? triggers : [triggers];
  return values.filter((value): value is AutomationEventType => Boolean(value));
};

export class AutomationEngine {
  private readonly tasks = new Map<string, InternalTask>();
  private readonly taskStats = new Map<string, { runs: number; lastRunAt?: number }>();
  private readonly taskLastRun = new Map<string, number>();
  private readonly jobs = new Map<string, InternalJob>();
  private readonly state = new Map<string, unknown>();
  private readonly baseContext: Omit<AutomationContext, 'getState' | 'setState' | 'deleteState'>;

  constructor(context: Omit<AutomationContext, 'getState' | 'setState' | 'deleteState'> = {}) {
    this.baseContext = context;
  }

  private buildContext(): AutomationContext {
    return {
      ...this.baseContext,
      getState: (key) => this.state.get(key) as unknown,
      setState: (key, value) => {
        this.state.set(key, value);
      },
      deleteState: (key) => {
        this.state.delete(key);
      },
    };
  }

  private async log(event: AutomationLogEvent) {
    const logger = this.baseContext.logger;
    if (logger) {
      try {
        await logger(event);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Automation logger error', error);
      }
    }
  }

  registerTask(task: AutomationTask): string {
    const id = task.id ?? randomUUID();
    if (this.tasks.has(id)) {
      throw new Error(`Automation task with id "${id}" already registered`);
    }
    const normalized: InternalTask = {
      ...task,
      id,
      triggers: normalizeTriggers(task.triggers),
    };
    if (normalized.triggers.length === 0) {
      throw new Error('Automation task must declare at least one trigger');
    }
    this.tasks.set(id, normalized);
    this.taskStats.set(id, { runs: 0 });
    void this.log({ level: 'info', message: 'Automation task registered', taskId: id, meta: { triggers: normalized.triggers } });
    return id;
  }

  removeTask(taskId: string): boolean {
    const existed = this.tasks.delete(taskId);
    if (existed) {
      this.taskStats.delete(taskId);
      this.taskLastRun.delete(taskId);
      void this.log({ level: 'debug', message: 'Automation task removed', taskId });
    }
    return existed;
  }

  getTask(taskId: string): InternalTask | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(): AutomationTaskStatus[] {
    return [...this.tasks.values()].map((task) => {
      const stats = this.taskStats.get(task.id) ?? { runs: 0 };
      return {
        id: task.id,
        description: task.description,
        triggers: task.triggers,
        runs: stats.runs,
        lastRunAt: stats.lastRunAt,
        once: task.once,
        cooldownMs: task.cooldownMs,
      };
    });
  }

  async handle(event: AutomationEvent) {
    const context = this.buildContext();
    const now = Date.now();
    for (const task of this.tasks.values()) {
      if (!task.triggers.includes(event.type)) {
        continue;
      }
      if (task.cooldownMs) {
        const lastRun = this.taskLastRun.get(task.id);
        if (lastRun && now - lastRun < task.cooldownMs) {
          continue;
        }
      }
      try {
        if (task.filter) {
          const allowed = await task.filter(event as never, context);
          if (!allowed) {
            continue;
          }
        }
        await task.run(event as never, context);
        const stats = this.taskStats.get(task.id);
        if (stats) {
          stats.runs += 1;
          stats.lastRunAt = now;
          this.taskStats.set(task.id, stats);
        }
        this.taskLastRun.set(task.id, now);
        void this.log({ level: 'debug', message: 'Automation task executed', taskId: task.id, meta: { event: event.type } });
      } catch (error) {
        void this.log({
          level: 'error',
          message: 'Automation task failed',
          taskId: task.id,
          meta: { event: event.type },
          error,
        });
      }
      if (task.once) {
        this.removeTask(task.id);
      }
    }
  }

  registerJob(job: AutomationJob): string {
    if (job.intervalMs <= 0) {
      throw new Error('Automation job interval must be greater than zero');
    }
    const id = job.id ?? randomUUID();
    if (this.jobs.has(id)) {
      throw new Error(`Automation job with id "${id}" already registered`);
    }
    const internal: InternalJob = {
      ...job,
      id,
      runs: 0,
    };
    internal.handle = setInterval(() => {
      void this.executeJob(internal);
    }, job.intervalMs);
    this.jobs.set(id, internal);
    void this.log({ level: 'info', message: 'Automation job scheduled', taskId: id, meta: { intervalMs: job.intervalMs } });
    if (job.immediate) {
      void this.executeJob(internal);
    }
    return id;
  }

  private async executeJob(job: InternalJob) {
    const context = this.buildContext();
    try {
      await job.run(context);
      job.runs += 1;
      job.lastRunAt = Date.now();
      this.jobs.set(job.id, job);
      void this.log({ level: 'debug', message: 'Automation job executed', taskId: job.id });
    } catch (error) {
      void this.log({ level: 'error', message: 'Automation job failed', taskId: job.id, error });
    }
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    if (job.handle) {
      clearInterval(job.handle);
    }
    this.jobs.delete(jobId);
    void this.log({ level: 'debug', message: 'Automation job cancelled', taskId: jobId });
    return true;
  }

  listJobs(): RegisteredAutomationJob[] {
    return [...this.jobs.values()].map(({ handle: _handle, ...job }) => job);
  }

  stopAllJobs() {
    for (const job of this.jobs.values()) {
      if (job.handle) {
        clearInterval(job.handle);
        job.handle = undefined;
      }
    }
    void this.log({ level: 'info', message: 'Automation jobs stopped' });
  }

  clearState(key?: string) {
    if (typeof key === 'string') {
      this.state.delete(key);
      return;
    }
    this.state.clear();
  }
}
