import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AdminGate } from './AdminGate';
import { savedSession } from '../../src/api';

vi.mock('../../src/api', () => ({ savedSession: vi.fn() }));
vi.mock('../../src/Dashboard', () => ({ Dashboard: () => <div>Admin dashboard</div> }));

afterEach(() => vi.clearAllMocks());

describe('AdminGate', () => {
  it('shows a loading state before the session check resolves', () => {
    vi.mocked(savedSession).mockReturnValue(null);
    render(<AdminGate />);
    expect(screen.getByText(/Checking administrator access/)).toBeInTheDocument();
  });

  it('redirects away when there is no admin session', async () => {
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, replace });
    vi.mocked(savedSession).mockReturnValue(null);

    render(<AdminGate />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login/admin'));
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
  });

  it('redirects a non-admin account away from the dashboard', async () => {
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, replace });
    vi.mocked(savedSession).mockReturnValue({ user: { accountType: 'CUSTOMER' } } as never);

    render(<AdminGate />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login/admin'));
  });

  it('renders the dashboard once an admin session is confirmed', async () => {
    vi.mocked(savedSession).mockReturnValue({ user: { accountType: 'ADMIN' } } as never);

    render(<AdminGate />);

    await waitFor(() => expect(screen.getByText('Admin dashboard')).toBeInTheDocument());
  });
});
