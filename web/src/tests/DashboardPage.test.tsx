import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardPage } from '../pages/DashboardPage.tsx';
import { renderWithProviders } from './renderWithProviders.tsx';
import type { LatestSnapshot, Service } from '../api/types.ts';

const { fetchServices, fetchLatestMetrics } = vi.hoisted(() => ({
  fetchServices: vi.fn(),
  fetchLatestMetrics: vi.fn(),
}));

vi.mock('../api/endpoints.ts', () => ({
  fetchServices,
  fetchLatestMetrics,
  fetchCurrentUser: vi.fn().mockRejectedValue(new Error('anonymous')),
  fetchMetricHistory: vi.fn(),
  fetchMetricDefinitions: vi.fn(),
  fetchActiveAlerts: vi.fn().mockResolvedValue([]),
  fetchAlertEvents: vi.fn().mockResolvedValue([]),
  fetchAlertRules: vi.fn().mockResolvedValue([]),
  login: vi.fn(),
}));

function service(slug: string, environment = 'production'): Service {
  return {
    id: 1,
    slug,
    displayName: slug.replace('-', ' '),
    baseUrl: `http://${slug}:8080`,
    healthPath: '/health',
    environment,
    pollIntervalSeconds: 10,
    timeoutMs: 2000,
    enabled: true,
    createdAt: '2025-03-01T10:00:00.000Z',
    updatedAt: '2025-03-01T10:00:00.000Z',
  };
}

function snapshot(slug: string, metrics: Record<string, number>): LatestSnapshot {
  const recordedAt = new Date().toISOString();
  return {
    service: slug,
    metrics: Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [key, { value, recordedAt }]),
    ),
  };
}

describe('DashboardPage', () => {
  beforeEach(() => {
    fetchServices.mockResolvedValue([
      service('checkout-api'),
      service('search-api', 'staging'),
      service('billing-worker'),
    ]);
    fetchLatestMetrics.mockResolvedValue([
      snapshot('checkout-api', { availability: 1, latency_p95_ms: 120, error_rate: 0 }),
      snapshot('search-api', { availability: 1, latency_p95_ms: 900, error_rate: 0.08 }),
      snapshot('billing-worker', { availability: 0, latency_ms: 3000 }),
    ]);
  });

  it('renders a card for every registered service', async () => {
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('checkout api')).toBeInTheDocument();
    expect(screen.getByText('search api')).toBeInTheDocument();
    expect(screen.getByText('billing worker')).toBeInTheDocument();
  });

  it('shows the derived health of each service', async () => {
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
      expect(screen.getByText('billing worker')).toBeInTheDocument();
    });
    expect(screen.queryByText('search api')).not.toBeInTheDocument();
  });

  it('explains an empty registry', async () => {
    fetchServices.mockResolvedValue([]);
    fetchLatestMetrics.mockResolvedValue([]);

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('No services registered')).toBeInTheDocument();
  });

  it('surfaces an API failure', async () => {
    fetchServices.mockRejectedValue(new Error('database unavailable'));

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Could not load services')).toBeInTheDocument();
    expect(screen.getByText('database unavailable')).toBeInTheDocument();
  });
});
