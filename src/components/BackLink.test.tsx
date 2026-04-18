import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import BackLink from './BackLink';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@heroicons/react/24/solid', () => ({
  ChevronLeftIcon: () => <svg data-testid="chevron-left-icon" />,
}));

describe('BackLink', () => {
  it('renders a link with the correct href', () => {
    render(<BackLink href="/watchlist" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/watchlist');
  });

  it('renders default label text "Back"', () => {
    render(<BackLink href="/" />);
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('renders custom label text when provided', () => {
    render(<BackLink href="/" label="Go Home" />);
    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('renders the chevron icon', () => {
    render(<BackLink href="/" />);
    expect(screen.getByTestId('chevron-left-icon')).toBeInTheDocument();
  });
});
