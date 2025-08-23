import type { AlertStateRepository } from '../repositories/alertStateRepository.js';
import { alertStateRepository } from '../repositories/alertStateRepository.js';
import type { SnapshotRepository } from '../repositories/snapshotRepository.js';
import { snapshotRepository } from '../repositories/snapshotRepository.js';
import type { MetricCatalog } from './metricCatalog.js';
import { metricCatalog } from './metricCatalog.js';
import type { ServiceDirectory } from './serviceDirectory.js';
import { serviceDirectory } from './serviceDirectory.js';
import { TtlCache } from '../lib/cache.js';
import { env } from '../config/env.js';
import type { ActiveAlert, AlertState } from '../types/alerts.js';
import type { ServiceRecord } from '../types/service.js';

export type HealthStatus = AlertState | 'UNKNOWN';

export const STALE_INTERVAL_MULTIPLIER = 6;
export const MIN_STALE_SECONDS = 60;

export interface DashboardReading {
  value: number;
  recordedAt: string;
}

export interface DashboardService {
  slug: string;
  displayName: string;
  environment: string;
  enabled: boolean;
  pollIntervalSeconds: number;
  status: HealthStatus;
  reasons: string[];
  lastSeen: string | null;
  metrics: Record<string, DashboardReading>;
}

export interface DashboardTotals {
  services: number;
  ok: number;
  warning: number;
  critical: number;
  unknown: number;
  activeAlerts: number;
  criticalAlerts: number;
}

export interface DashboardSummary {
  generatedAt: string;
  totals: DashboardTotals;
  services: DashboardService[];
  alerts: ActiveAlert[];
}

const SEVERITY: Record<HealthStatus, number> = { UNKNOWN: 0, OK: 1, WARNING: 2, CRITICAL: 3 };

export function staleAfterSeconds(pollIntervalSeconds: number): number {
  return Math.max(pollIntervalSeconds * STALE_INTERVAL_MULTIPLIER, MIN_STALE_SECONDS);
}

export class DashboardBuilder {
  private readonly directory: ServiceDirectory;
  private readonly snapshots: SnapshotRepository;
  private readonly states: AlertStateRepository;
  private readonly catalog: MetricCatalog;
  private readonly cache: TtlCache<DashboardSummary>;

  constructor(
    directory: ServiceDirectory = serviceDirectory,
    snapshots: SnapshotRepository = snapshotRepository,
    states: AlertStateRepository = alertStateRepository,
    catalog: MetricCatalog = metricCatalog,
  ) {
    this.directory = directory;
    this.snapshots = snapshots;
    this.states = states;
    this.catalog = catalog;
    this.cache = new TtlCache<DashboardSummary>(env.DASHBOARD_CACHE_TTL_MS);
  }

  private static statusFor(
    service: ServiceRecord,
    lastSeen: string | null,
    alerts: ActiveAlert[],
    now: Date,
  ): { status: HealthStatus; reasons: string[] } {
    if (lastSeen === null) {
      return { status: 'UNKNOWN', reasons: ['no data collected yet'] };
    }

    const ageSeconds = (now.getTime() - new Date(lastSeen).getTime()) / 1000;
    if (ageSeconds > staleAfterSeconds(service.pollIntervalSeconds)) {
      return { status: 'UNKNOWN', reasons: ['no recent snapshots'] };
    }

    let status: HealthStatus = 'OK';
    const reasons: string[] = [];

    for (const alert of alerts) {
      if (SEVERITY[alert.state] > SEVERITY[status]) {
        status = alert.state;
      }
      reasons.push(alert.message);
    }

    return { status, reasons };
  }

  private async build(now: Date): Promise<DashboardSummary> {
    const [services, definitions, alerts] = await Promise.all([
      this.directory.all(),
      this.catalog.all(),
      this.states.listActive(),
    ]);

    const keyById = new Map(definitions.map((definition) => [definition.id, definition.key]));
    const latest = await this.snapshots.latestValues(services.map((service) => service.id));

    const readings = new Map<number, Record<string, DashboardReading>>();
    const newest = new Map<number, string>();

    for (const value of latest) {
      const key = keyById.get(value.metricId);
      if (key === undefined) {
        continue;
      }
      const bucket = readings.get(value.serviceId) ?? {};
      bucket[key] = { value: value.value, recordedAt: value.recordedAt };
      readings.set(value.serviceId, bucket);

      const previous = newest.get(value.serviceId);
      if (previous === undefined || value.recordedAt > previous) {
        newest.set(value.serviceId, value.recordedAt);
      }
    }

    const alertsByService = new Map<number, ActiveAlert[]>();
    for (const alert of alerts) {
      alertsByService.set(alert.serviceId, [
        ...(alertsByService.get(alert.serviceId) ?? []),
        alert,
      ]);
    }

    const totals: DashboardTotals = {
      services: services.length,
      ok: 0,
      warning: 0,
      critical: 0,
      unknown: 0,
      activeAlerts: alerts.length,
      criticalAlerts: alerts.filter((alert) => alert.state === 'CRITICAL').length,
    };

    const rows = services.map((service) => {
      const lastSeen = newest.get(service.id) ?? null;
      const serviceAlerts = alertsByService.get(service.id) ?? [];
      const { status, reasons } = DashboardBuilder.statusFor(service, lastSeen, serviceAlerts, now);

      if (status === 'OK') {
        totals.ok += 1;
      } else if (status === 'WARNING') {
        totals.warning += 1;
      } else if (status === 'CRITICAL') {
        totals.critical += 1;
      } else {
        totals.unknown += 1;
      }

      return {
        slug: service.slug,
        displayName: service.displayName,
        environment: service.environment,
        enabled: service.enabled,
        pollIntervalSeconds: service.pollIntervalSeconds,
        status,
        reasons,
        lastSeen,
        metrics: readings.get(service.id) ?? {},
      };
    });

    return { generatedAt: now.toISOString(), totals, services: rows, alerts };
  }

  async summary(now: Date = new Date()): Promise<DashboardSummary> {
    return this.cache.resolve('summary', () => this.build(now));
  }

  invalidate(): void {
    this.cache.invalidate();
  }

  get cacheStats(): { hits: number; misses: number; size: number } {
    return this.cache.stats;
  }
}

export const dashboardService = new DashboardBuilder();
