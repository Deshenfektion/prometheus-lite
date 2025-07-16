import type { ServiceRepository } from '../repositories/serviceRepository.js';
import { serviceRepository } from '../repositories/serviceRepository.js';
import { ConflictError, NotFoundError, isUniqueViolation } from '../lib/errors.js';
import { serviceDirectory } from './serviceDirectory.js';
import type {
  CreateServiceInput,
  ServiceFilter,
  ServiceRecord,
  UpdateServiceInput,
} from '../types/service.js';

export class ServiceRegistry {
  private readonly repository: ServiceRepository;

  constructor(repository: ServiceRepository = serviceRepository) {
    this.repository = repository;
  }

  async list(filter: ServiceFilter = {}): Promise<ServiceRecord[]> {
    return this.repository.list(filter);
  }

  async getBySlug(slug: string): Promise<ServiceRecord> {
    const service = await this.repository.findBySlug(slug);
    if (service === null) {
      throw new NotFoundError('Service', slug);
    }
    return service;
  }

  async create(input: CreateServiceInput): Promise<ServiceRecord> {
    try {
      const created = await this.repository.create(input);
      serviceDirectory.invalidate();
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(`Service '${input.slug}' already exists`);
      }
      throw error;
    }
  }

  async update(slug: string, patch: UpdateServiceInput): Promise<ServiceRecord> {
    const existing = await this.getBySlug(slug);
    const updated = await this.repository.update(existing.id, patch);
    if (updated === null) {
      throw new NotFoundError('Service', slug);
    }
    serviceDirectory.invalidate();
    return updated;
  }

  async remove(slug: string): Promise<void> {
    const existing = await this.getBySlug(slug);
    await this.repository.remove(existing.id);
    serviceDirectory.invalidate();
  }
}

export const serviceRegistry = new ServiceRegistry();
