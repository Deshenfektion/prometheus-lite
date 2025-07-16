import type { MetricRepository } from '../repositories/metricRepository.js';
import { metricRepository } from '../repositories/metricRepository.js';
import type { MetricDefinition } from '../types/metrics.js';

const REFRESH_INTERVAL_MS = 60_000;

export class MetricCatalog {
  private readonly repository: MetricRepository;
  private byKey = new Map<string, MetricDefinition>();
  private byId = new Map<number, MetricDefinition>();
  private loadedAt = 0;
  private inFlight: Promise<void> | null = null;

  constructor(repository: MetricRepository = metricRepository) {
    this.repository = repository;
  }

  private async load(): Promise<void> {
    const definitions = await this.repository.list();
    this.byKey = new Map(definitions.map((definition) => [definition.key, definition]));
    this.byId = new Map(definitions.map((definition) => [definition.id, definition]));
    this.loadedAt = Date.now();
  }

  private async ensureFresh(): Promise<void> {
    if (Date.now() - this.loadedAt < REFRESH_INTERVAL_MS && this.byKey.size > 0) {
      return;
    }
    this.inFlight ??= this.load().finally(() => {
      this.inFlight = null;
    });
    await this.inFlight;
  }

  async all(): Promise<MetricDefinition[]> {
    await this.ensureFresh();
    return [...this.byKey.values()];
  }

  async resolveKey(key: string): Promise<MetricDefinition | undefined> {
    await this.ensureFresh();
    return this.byKey.get(key);
  }

  async resolveId(id: number): Promise<MetricDefinition | undefined> {
    await this.ensureFresh();
    return this.byId.get(id);
  }

  invalidate(): void {
    this.loadedAt = 0;
  }
}

export const metricCatalog = new MetricCatalog();
