import { randomUUID } from 'crypto';

export interface TelemetryCollectorOptions {
  /**
   * Número máximo de eventos armazenados no buffer circular.
   * Valores menores que 1 serão ajustados automaticamente para 1.
   */
  maxEvents?: number;
}

interface CounterRecord {
  value: number;
  updatedAt: number;
}

interface GaugeRecord {
  value: number;
  updatedAt: number;
}

interface MeasurementRecord {
  count: number;
  sum: number;
  min: number;
  max: number;
  last: number;
  lastUpdatedAt: number;
}

export interface TelemetryCounterSnapshot extends CounterRecord {
  name: string;
}

export interface TelemetryGaugeSnapshot extends GaugeRecord {
  name: string;
}

export interface TelemetryMeasurementSnapshot {
  name: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  average: number;
  last: number;
  lastUpdatedAt: number;
}

export interface TelemetryEventSnapshot {
  id: string;
  name: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}

export interface TelemetrySnapshot {
  generatedAt: number;
  counters: TelemetryCounterSnapshot[];
  gauges: TelemetryGaugeSnapshot[];
  measurements: TelemetryMeasurementSnapshot[];
  events: TelemetryEventSnapshot[];
}

const normalizeMaxEvents = (value?: number) => {
  if (!value || Number.isNaN(value) || value < 1) {
    return 1;
  }
  return Math.floor(value);
};

const clampNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
};

export class TelemetryCollector {
  private readonly counters = new Map<string, CounterRecord>();

  private readonly gauges = new Map<string, GaugeRecord>();

  private readonly measurements = new Map<string, MeasurementRecord>();

  private events: TelemetryEventSnapshot[] = [];

  private readonly maxEvents: number;

  constructor(options: TelemetryCollectorOptions = {}) {
    this.maxEvents = normalizeMaxEvents(options.maxEvents ?? 200);
  }

  private now() {
    return Date.now();
  }

  increment(name: string, delta = 1) {
    const safeDelta = clampNumber(delta);
    const record = this.counters.get(name) ?? { value: 0, updatedAt: this.now() };
    record.value += safeDelta;
    record.updatedAt = this.now();
    this.counters.set(name, record);
  }

  setCounter(name: string, value: number) {
    const record: CounterRecord = { value: clampNumber(value), updatedAt: this.now() };
    this.counters.set(name, record);
  }

  getCounter(name: string) {
    return this.counters.get(name)?.value ?? 0;
  }

  setGauge(name: string, value: number) {
    const record: GaugeRecord = { value: clampNumber(value), updatedAt: this.now() };
    this.gauges.set(name, record);
  }

  getGauge(name: string) {
    return this.gauges.get(name)?.value;
  }

  observe(name: string, value: number) {
    const safeValue = clampNumber(value);
    const record = this.measurements.get(name);
    if (!record) {
      this.measurements.set(name, {
        count: 1,
        sum: safeValue,
        min: safeValue,
        max: safeValue,
        last: safeValue,
        lastUpdatedAt: this.now(),
      });
      return;
    }
    record.count += 1;
    record.sum += safeValue;
    record.min = Math.min(record.min, safeValue);
    record.max = Math.max(record.max, safeValue);
    record.last = safeValue;
    record.lastUpdatedAt = this.now();
    this.measurements.set(name, record);
  }

  async time<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const start = this.now();
    try {
      const result = await fn();
      this.observe(name, this.now() - start);
      return result;
    } catch (error) {
      this.observe(`${name}:error`, this.now() - start);
      throw error;
    }
  }

  recordEvent(name: string, payload?: Record<string, unknown>) {
    const event: TelemetryEventSnapshot = {
      id: randomUUID(),
      name,
      timestamp: this.now(),
      payload,
    };
    this.events = [...this.events.slice(-(this.maxEvents - 1)), event];
  }

  clearEvents() {
    this.events = [];
  }

  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.measurements.clear();
    this.clearEvents();
  }

  snapshot(): TelemetrySnapshot {
    const counters: TelemetryCounterSnapshot[] = [...this.counters.entries()].map(([name, record]) => ({
      name,
      value: record.value,
      updatedAt: record.updatedAt,
    }));
    const gauges: TelemetryGaugeSnapshot[] = [...this.gauges.entries()].map(([name, record]) => ({
      name,
      value: record.value,
      updatedAt: record.updatedAt,
    }));
    const measurements: TelemetryMeasurementSnapshot[] = [...this.measurements.entries()].map(([name, record]) => ({
      name,
      count: record.count,
      sum: record.sum,
      min: record.min,
      max: record.max,
      average: record.sum / record.count,
      last: record.last,
      lastUpdatedAt: record.lastUpdatedAt,
    }));
    return {
      generatedAt: this.now(),
      counters: counters.sort((a, b) => a.name.localeCompare(b.name)),
      gauges: gauges.sort((a, b) => a.name.localeCompare(b.name)),
      measurements: measurements.sort((a, b) => a.name.localeCompare(b.name)),
      events: [...this.events],
    };
  }
}

export const createTelemetryCollector = (options?: TelemetryCollectorOptions) => new TelemetryCollector(options);
