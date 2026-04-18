import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import PaywallModal from './PaywallModal';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

describe('PaywallModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal content', () => {
    const onClose = vi.fn();
    render(<PaywallModal onClose={onClose} />);
    expect(screen.getByText(/free recommendations used up/i)).toBeInTheDocument();
  });

  it('shows the pricing', () => {
    render(<PaywallModal onClose={vi.fn()} />);
    expect(screen.getByText('£1.99')).toBeInTheDocument();
    expect(screen.getByText(/per month/i)).toBeInTheDocument();
  });

  it('shows feature list', () => {
    render(<PaywallModal onClose={vi.fn()} />);
    expect(screen.getByText(/unlimited ai profile recommendations/i)).toBeInTheDocument();
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

  it('renders the subscribe button', () => {
    render(<PaywallModal onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /subscribe for £1\.99/i })).toBeInTheDocument();
  });

  it('calls checkout API and redirects when subscribe button is clicked', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/test';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: checkoutUrl }),
    });
    vi.stubGlobal('fetch', mockFetch);

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

  it('shows "Redirecting…" while loading after subscribe click', async () => {
    // Use a never-resolving fetch to hold the loading state
    const mockFetch = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', mockFetch);

    render(<PaywallModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /subscribe for £1\.99/i }));
    expect(await screen.findByText('Redirecting…')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('renders "Cancel anytime" note', () => {
    render(<PaywallModal onClose={vi.fn()} />);
    expect(screen.getByText(/cancel anytime/i)).toBeInTheDocument();
  });
});
