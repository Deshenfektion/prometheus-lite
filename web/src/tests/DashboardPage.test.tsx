import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardPage } from '../pages/DashboardPage.tsx';
import { renderWithProviders } from './renderWithProviders.tsx';
import type { DashboardService, DashboardSummary, HealthStatus } from '../api/types.ts';

const { fetchDashboard } = vi.hoisted(() => ({ fetchDashboard: vi.fn() }));

vi.mock('../api/endpoints.ts', () => ({
  fetchDashboard,
  fetchServices: vi.fn(),
  fetchLatestMetrics: vi.fn(),
  fetchCurrentUser: vi.fn().mockRejectedValue(new Error('anonymous')),
  fetchMetricHistory: vi.fn(),
  fetchMetricAnomalies: vi.fn(),
  fetchMetricDefinitions: vi.fn(),
  fetchActiveAlerts: vi.fn().mockResolvedValue([]),
  fetchAlertEvents: vi.fn().mockResolvedValue([]),
  fetchAlertRules: vi.fn().mockResolvedValue([]),
  login: vi.fn(),
}));

function service(
  slug: string,
  status: HealthStatus,
  metrics: Record<string, number>,
  environment = 'production',
): DashboardService {
  const recordedAt = new Date().toISOString();
  return {
    slug,
    displayName: slug.replace('-', ' '),
    environment,
    enabled: true,
    pollIntervalSeconds: 10,
    status,
    reasons: [],
    lastSeen: recordedAt,
    metrics: Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [key, { value, recordedAt }]),
    ),
  };
}

function summary(services: DashboardService[]): DashboardSummary {
  return {
    generatedAt: new Date().toISOString(),
    totals: {
      services: services.length,
      ok: services.filter((entry) => entry.status === 'OK').length,
      warning: services.filter((entry) => entry.status === 'WARNING').length,
      critical: services.filter((entry) => entry.status === 'CRITICAL').length,
      unknown: services.filter((entry) => entry.status === 'UNKNOWN').length,
      activeAlerts: 0,
      criticalAlerts: 0,
    },
    services,
    alerts: [],
  };
}

describe('DashboardPage', () => {
  beforeEach(() => {
    fetchDashboard.mockResolvedValue(
      summary([
        service('checkout-api', 'OK', { latency_p95_ms: 120, error_rate: 0 }),
        service('search-api', 'WARNING', { latency_p95_ms: 900, error_rate: 0.08 }, 'staging'),
        service('billing-worker', 'CRITICAL', { latency_ms: 3000 }),
      ]),
    );
  });

  it('renders a card for every registered service', async () => {
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('checkout api')).toBeInTheDocument();
    expect(screen.getByText('search api')).toBeInTheDocument();
    expect(screen.getByText('billing worker')).toBeInTheDocument();
  });

  it('shows the status the API derived for each service', async () => {
    const { container } = renderWithProviders(<DashboardPage />);
    await screen.findByText('checkout api');

    const badges = [...container.querySelectorAll('[data-status]')].map((node) =>
      node.getAttribute('data-status'),
    );

    expect(badges).toEqual(['OK', 'WARNING', 'CRITICAL']);
  });

  it('formats the latency and error columns', async () => {
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('120 ms')).toBeInTheDocument();
    expect(screen.getByText('8.00%')).toBeInTheDocument();
  });

  it('filters the grid by name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />);
    await screen.findByText('checkout api');

    await user.type(screen.getByLabelText('Filter services by name'), 'search');

    await waitFor(() => {
      expect(screen.queryByText('checkout api')).not.toBeInTheDocument();
    });
    expect(screen.getByText('search api')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 services')).toBeInTheDocument();
  });

  it('filters the grid by environment', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />);
    await screen.findByText('checkout api');

    await user.selectOptions(screen.getByLabelText('Environment'), 'staging');

    await waitFor(() => {
      expect(screen.queryByText('checkout api')).not.toBeInTheDocument();
    });
    expect(screen.getByText('search api')).toBeInTheDocument();
  });

  it('filters the grid by health status', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />);
    await screen.findByText('checkout api');

    await user.selectOptions(screen.getByLabelText('Health status'), 'CRITICAL');

    await waitFor(() => {
      expect(screen.queryByText('search api')).not.toBeInTheDocument();
    });
    expect(screen.getByText('billing worker')).toBeInTheDocument();
  });

  it('explains an empty registry', async () => {
    fetchDashboard.mockResolvedValue(summary([]));

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('No services registered')).toBeInTheDocument();
  });

  it('surfaces an API failure', async () => {
    fetchDashboard.mockRejectedValue(new Error('database unavailable'));

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Could not load services')).toBeInTheDocument();
    expect(screen.getByText('database unavailable')).toBeInTheDocument();
  });
});
