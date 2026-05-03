import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import PaywallModal from './PaywallModal';

describe('PaywallModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- Default (free_exhausted) variant ----

  it('renders free-exhausted heading by default', () => {
    render(<PaywallModal onClose={vi.fn()} />);
    expect(screen.getByText(/free recommendations used up/i)).toBeInTheDocument();
  });

  it('renders free-exhausted heading when reason is free_exhausted', () => {
    render(<PaywallModal onClose={vi.fn()} reason="free_exhausted" />);
    expect(screen.getByText(/free recommendations used up/i)).toBeInTheDocument();
  });

  it('shows pricing block and subscribe button in free_exhausted variant', () => {
    render(<PaywallModal onClose={vi.fn()} />);
    expect(screen.getByText('£1.99')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subscribe for £1\.99/i })).toBeInTheDocument();
  });

  it('shows feature list in free_exhausted variant', () => {
    render(<PaywallModal onClose={vi.fn()} />);
    expect(screen.getByText(/up to 100 ai recommendations per month/i)).toBeInTheDocument();
  });

  it('renders the close button', () => {
    render(<PaywallModal onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<PaywallModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(<PaywallModal onClose={onClose} />);
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls checkout API and redirects when subscribe button is clicked', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: checkoutUrl }),
    }));
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
      writable: true,
    });

    render(<PaywallModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /subscribe for £1\.99/i }));

    await waitFor(() => {
      expect(window.location.href).toBe(checkoutUrl);
    });

    vi.unstubAllGlobals();
  });

  it('shows "Redirecting..." while loading after subscribe click', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    render(<PaywallModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /subscribe for £1\.99/i }));
    expect(await screen.findByText('Redirecting\u2026')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('renders "Cancel anytime" note', () => {
    render(<PaywallModal onClose={vi.fn()} />);
    expect(screen.getByText(/cancel anytime/i)).toBeInTheDocument();
  });

  // ---- monthly_limit variant ----

  it('renders monthly-limit heading when reason is monthly_limit', () => {
    render(<PaywallModal onClose={vi.fn()} reason="monthly_limit" />);
    expect(screen.getByText(/monthly limit reached/i)).toBeInTheDocument();
  });

  it('shows reset message in monthly_limit variant', () => {
    render(<PaywallModal onClose={vi.fn()} reason="monthly_limit" />);
    expect(screen.getByText(/resets automatically/i)).toBeInTheDocument();
  });

  it('does not show pricing or subscribe button in monthly_limit variant', () => {
    render(<PaywallModal onClose={vi.fn()} reason="monthly_limit" />);
    expect(screen.queryByText('£1.99')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument();
  });

  it('still shows close button in monthly_limit variant', () => {
    render(<PaywallModal onClose={vi.fn()} reason="monthly_limit" />);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });
});
