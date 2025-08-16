import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage.tsx';
import { RequireAuth } from '../auth/RequireAuth.tsx';
import { ApiError } from '../api/client.ts';
import { renderWithProviders } from './renderWithProviders.tsx';
import type { CurrentUser } from '../api/types.ts';

const { login, fetchCurrentUser } = vi.hoisted(() => ({
  login: vi.fn(),
  fetchCurrentUser: vi.fn(),
}));

vi.mock('../api/endpoints.ts', () => ({
  login,
  fetchCurrentUser,
  fetchServices: vi.fn().mockResolvedValue([]),
  fetchLatestMetrics: vi.fn().mockResolvedValue([]),
  fetchMetricHistory: vi.fn().mockResolvedValue([]),
  fetchMetricDefinitions: vi.fn().mockResolvedValue([]),
  fetchActiveAlerts: vi.fn().mockResolvedValue([]),
  fetchAlertEvents: vi.fn().mockResolvedValue([]),
  fetchAlertRules: vi.fn().mockResolvedValue([]),
}));

const USER: CurrentUser = {
  id: 1,
  email: 'admin@prometheus-lite.test',
  displayName: 'Test Admin',
  role: 'ADMIN',
  active: true,
  lastLoginAt: null,
  createdAt: '2025-03-01T10:00:00.000Z',
};

function ProtectedApp() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<h1>Service overview</h1>} />
      </Route>
      <Route element={<RequireAuth role="ADMIN" />}>
        <Route path="/admin" element={<h1>Admin area</h1>} />
      </Route>
    </Routes>
  );
}

describe('login', () => {
  beforeEach(() => {
    fetchCurrentUser.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Missing bearer token'));
  });

  it('stores the token and lands on the protected page', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({
      token: 'signed.jwt.token',
      expiresIn: 3600,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: USER,
    });

    renderWithProviders(<ProtectedApp />, { route: '/login' });

    await user.type(screen.getByLabelText('Email'), USER.email);
    await user.type(screen.getByLabelText('Password'), 'test-password-1234');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Service overview' })).toBeInTheDocument();
    expect(window.localStorage.getItem('prometheus-lite.token')).toBe('signed.jwt.token');
  });

  it('shows the API message when the credentials are rejected', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password'));

    renderWithProviders(<ProtectedApp />, { route: '/login' });

    await user.type(screen.getByLabelText('Email'), USER.email);
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(window.localStorage.getItem('prometheus-lite.token')).toBeNull();
  });

  it('explains an unreachable API', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new TypeError('Failed to fetch'));

    renderWithProviders(<ProtectedApp />, { route: '/login' });

    await user.type(screen.getByLabelText('Email'), USER.email);
    await user.type(screen.getByLabelText('Password'), 'test-password-1234');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the API');
  });
});

describe('RequireAuth', () => {
  it('redirects an anonymous visitor to the login page', async () => {
    fetchCurrentUser.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Missing bearer token'));

    renderWithProviders(<ProtectedApp />, { route: '/' });

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('restores a session from a stored token', async () => {
    window.localStorage.setItem('prometheus-lite.token', 'signed.jwt.token');
    fetchCurrentUser.mockResolvedValue(USER);

    renderWithProviders(<ProtectedApp />, { route: '/' });

    expect(await screen.findByRole('heading', { name: 'Service overview' })).toBeInTheDocument();
  });

  it('drops a session the API no longer accepts', async () => {
    window.localStorage.setItem('prometheus-lite.token', 'stale.jwt.token');
    fetchCurrentUser.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'expired'));

    renderWithProviders(<ProtectedApp />, { route: '/' });

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    await waitFor(() => {
      expect(window.localStorage.getItem('prometheus-lite.token')).toBeNull();
    });
  });

  it('blocks a reader from an admin-only route', async () => {
    window.localStorage.setItem('prometheus-lite.token', 'signed.jwt.token');
    fetchCurrentUser.mockResolvedValue({ ...USER, role: 'USER' });

    renderWithProviders(<ProtectedApp />, { route: '/admin' });

    expect(await screen.findByRole('heading', { name: 'Not allowed' })).toBeInTheDocument();
  });

  it('lets an admin through an admin-only route', async () => {
    window.localStorage.setItem('prometheus-lite.token', 'signed.jwt.token');
    fetchCurrentUser.mockResolvedValue(USER);

    renderWithProviders(<ProtectedApp />, { route: '/admin' });

    expect(await screen.findByRole('heading', { name: 'Admin area' })).toBeInTheDocument();
  });
});
