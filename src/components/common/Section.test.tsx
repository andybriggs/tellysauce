import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import Section from './Section';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@heroicons/react/24/solid', () => ({
  ChevronRightIcon: () => <svg data-testid="chevron-right-icon" />,
}));

describe('Section', () => {
  it('renders the section title', () => {
    render(
      <Section title="My Watchlist" isEmpty={false} emptyContent={<p>Empty</p>}>
        <p>Some content</p>
      </Section>
    );
    expect(screen.getByText('My Watchlist')).toBeInTheDocument();
  });

  it('renders children when not empty', () => {
    render(
      <Section title="Ratings" isEmpty={false} emptyContent={<p>No ratings yet</p>}>
        <p>Child content here</p>
      </Section>
    );
    expect(screen.getByText('Child content here')).toBeInTheDocument();
  });

  it('renders empty state content when isEmpty is true', () => {
    render(
      <Section
        title="Watchlist"
        isEmpty={true}
        emptyContent={<p>Your watchlist is empty</p>}
      >
        <p>Should not render</p>
      </Section>
    );
    expect(screen.getByText('Your watchlist is empty')).toBeInTheDocument();
    expect(screen.queryByText('Should not render')).toBeNull();
  });

  it('shows the title in empty state', () => {
    render(
      <Section title="Ratings" isEmpty={true} emptyContent={<span>Nothing rated</span>}>
        <div />
      </Section>
    );
    expect(screen.getByText('Ratings')).toBeInTheDocument();
  });

  it('renders view all link when showViewAll and viewAllHref are provided', () => {
    render(
      <Section
        title="Shows"
        isEmpty={false}
        emptyContent={<p>empty</p>}
        showViewAll={true}
        viewAllHref="/shows"
      >
        <p>content</p>
      </Section>
    );
    expect(screen.getByRole('link', { name: /view all/i })).toHaveAttribute('href', '/shows');
  });
});
