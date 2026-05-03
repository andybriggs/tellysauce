import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import BackLink from './BackLink';

const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

vi.mock('@heroicons/react/24/solid', () => ({
  ChevronLeftIcon: () => <svg data-testid="chevron-left-icon" />,
}));

describe('BackLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a button with default label "Back"', () => {
    render(<BackLink />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('renders custom label text when provided', () => {
    render(<BackLink label="Go Home" />);
    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('renders the chevron icon', () => {
    render(<BackLink />);
    expect(screen.getByTestId('chevron-left-icon')).toBeInTheDocument();
  });

  it('calls router.back() when history length > 1', () => {
    Object.defineProperty(window, 'history', {
      value: { length: 3 },
      writable: true,
      configurable: true,
    });
    render(<BackLink />);
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('calls router.push(fallbackHref) when history length is 1', () => {
    Object.defineProperty(window, 'history', {
      value: { length: 1 },
      writable: true,
      configurable: true,
    });
    render(<BackLink fallbackHref="/watchlist" />);
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(mockPush).toHaveBeenCalledWith('/watchlist');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('falls back to "/" by default when no fallbackHref is provided', () => {
    Object.defineProperty(window, 'history', {
      value: { length: 1 },
      writable: true,
      configurable: true,
    });
    render(<BackLink />);
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
