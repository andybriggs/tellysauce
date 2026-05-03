import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import CookieBanner from './CookieBanner';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const STORAGE_KEY = 'cookie_consent';

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the banner when localStorage has no consent key', () => {
    render(<CookieBanner />);
    expect(screen.getByText(/we use cookies/i)).toBeInTheDocument();
  });

  it('shows the "Got it" button', () => {
    render(<CookieBanner />);
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument();
  });

  it('hides the banner after clicking "Got it"', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryByText(/we use cookies/i)).toBeNull();
  });

  it('sets localStorage key after accepting', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('accepted');
  });

  it('does not show the banner if consent is already in localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    render(<CookieBanner />);
    expect(screen.queryByText(/we use cookies/i)).toBeNull();
  });

  it('renders the Privacy Policy link', () => {
    render(<CookieBanner />);
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
  });
});
