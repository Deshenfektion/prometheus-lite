export interface ServiceRecord {
  id: number;
  slug: string;
  displayName: string;
  baseUrl: string;
  healthPath: string;
  environment: string;
  pollIntervalSeconds: number;
  timeoutMs: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceInput {
  slug: string;
  displayName: string;
  baseUrl: string;
  healthPath?: string;
  environment?: string;
  pollIntervalSeconds?: number;
  timeoutMs?: number;
  enabled?: boolean;
}

export type UpdateServiceInput = Partial<Omit<CreateServiceInput, 'slug'>>;

export interface ServiceFilter {
  environment?: string;
  enabled?: boolean;
}
