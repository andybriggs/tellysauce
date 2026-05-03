import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import SectionHeader from './SectionHeader';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@heroicons/react/24/solid', () => ({
  ChevronRightIcon: () => <svg data-testid="chevron-right-icon" />,
}));

describe('SectionHeader', () => {
  it('renders the heading text', () => {
    render(<SectionHeader title="Popular Movies" />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Popular Movies');
  });

  it('renders the view-all link when showViewAll and viewAllHref are provided', () => {
    render(<SectionHeader title="Top Rated" showViewAll={true} viewAllHref="/top-rated" />);
    const link = screen.getByRole('link', { name: /view all/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/top-rated');
  });

  it('hides the view-all link when showViewAll is false', () => {
    render(<SectionHeader title="Top Rated" showViewAll={false} viewAllHref="/top-rated" />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('hides the view-all link when viewAllHref is not provided', () => {
    render(<SectionHeader title="Top Rated" showViewAll={true} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders contentAfter when provided', () => {
    render(<SectionHeader title="Shows" contentAfter={<span>Filter here</span>} />);
    expect(screen.getByText('Filter here')).toBeInTheDocument();
  });

  it('does not render contentAfter wrapper when not provided', () => {
    render(<SectionHeader title="Shows" />);
    expect(screen.queryByText('Filter here')).toBeNull();
  });
});
