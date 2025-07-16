import type { ServiceRepository } from '../repositories/serviceRepository.js';
import { serviceRepository } from '../repositories/serviceRepository.js';
import type { ServiceRecord } from '../types/service.js';

const REFRESH_INTERVAL_MS = 30_000;

export class ServiceDirectory {
  private readonly repository: ServiceRepository;
  private bySlug = new Map<string, ServiceRecord>();
  private loadedAt = 0;
  private inFlight: Promise<void> | null = null;

  constructor(repository: ServiceRepository = serviceRepository) {
    this.repository = repository;
  }

  private async load(): Promise<void> {
    const services = await this.repository.list();
    this.bySlug = new Map(services.map((service) => [service.slug, service]));
    this.loadedAt = Date.now();
  }

  private async ensureFresh(): Promise<void> {
    if (this.loadedAt !== 0 && Date.now() - this.loadedAt < REFRESH_INTERVAL_MS) {
      return;
    }
    this.inFlight ??= this.load().finally(() => {
      this.inFlight = null;
    });
    await this.inFlight;
  }

  async resolve(slug: string): Promise<ServiceRecord | undefined> {
    await this.ensureFresh();
    return this.bySlug.get(slug);
  }

  async all(): Promise<ServiceRecord[]> {
    await this.ensureFresh();
    return [...this.bySlug.values()];
  }

  invalidate(): void {
    this.loadedAt = 0;
  }
}

export const serviceDirectory = new ServiceDirectory();
