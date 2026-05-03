import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { SWRConfig } from 'swr';
import UserTitleList from './UserTitleList';
import type { Title } from '@/types';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@heroicons/react/24/solid', () => ({
  ChevronLeftIcon: () => <svg data-testid="chevron-left" />,
  ChevronRightIcon: () => <svg data-testid="chevron-right" />,
  StarIcon: ({ className }: { className?: string }) => (
    <svg data-testid="star-filled" className={className} />
  ),
}));

vi.mock('@heroicons/react/24/outline', () => ({
  StarIcon: ({ className }: { className?: string }) => (
    <svg data-testid="star-outline" className={className} />
  ),
}));

vi.mock('@/hooks/useRatedTitles', () => ({
  useRatedTitles: vi.fn(() => ({
    hasMounted: true,
    isSubmittingId: vi.fn(() => false),
    rateTitle: vi.fn(),
    getRating: vi.fn(() => 0),
  })),
}));

vi.mock('embla-carousel-react', () => ({
  default: () => [
    vi.fn(),
    {
      scrollPrev: vi.fn(),
      scrollNext: vi.fn(),
      canScrollPrev: vi.fn(() => false),
      canScrollNext: vi.fn(() => false),
      on: vi.fn(),
      off: vi.fn(),
    },
  ],
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

const baseProps = {
  sectionTitle: '🍿 My Watchlist',
  emptyText: 'Add titles to your watchlist',
  viewAllHref: '/watchlist',
  gridHeading: '🍿 My Watchlist',
};

const mockItems: Title[] = [
  { id: 1, name: 'Twin Peaks', poster: '/tp.jpg', type: 'tv', rating: 0, description: null },
  { id: 2, name: 'Inception', poster: '/in.jpg', type: 'movie', rating: 0, description: null },
];

const mixedWithGenres: Title[] = [
  { id: 1, name: 'Twin Peaks', poster: null, type: 'tv', rating: 0, description: null, genres: ['Mystery', 'Drama'] },
  { id: 2, name: 'Inception', poster: null, type: 'movie', rating: 0, description: null, genres: ['Sci-Fi'] },
];

describe('UserTitleList – carousel mode', () => {
  it('renders the section title', () => {
    render(<UserTitleList {...baseProps} items={mockItems} />, { wrapper });
    expect(screen.getByText(/My Watchlist/i)).toBeInTheDocument();
  });

  it('shows empty state when items is empty', () => {
    render(<UserTitleList {...baseProps} items={[]} />, { wrapper });
    expect(screen.getByText(/Add titles to your watchlist/i)).toBeInTheDocument();
  });

  it('renders title cards for each item', () => {
    render(<UserTitleList {...baseProps} items={mockItems} />, { wrapper });
    expect(screen.getByText('Twin Peaks')).toBeInTheDocument();
    expect(screen.getByText('Inception')).toBeInTheDocument();
  });

  it('passes rateTitle to TitleCard when provided', () => {
    const rateTitle = vi.fn();
    render(
      <UserTitleList {...baseProps} items={mockItems} rateTitle={rateTitle} />,
      { wrapper }
    );
    // Star rating buttons should be present
    const stars = screen.getAllByRole('button', { name: /rate/i });
    expect(stars.length).toBeGreaterThan(0);
  });

  it('does NOT render star rating buttons when rateTitle is omitted', () => {
    render(<UserTitleList {...baseProps} items={mockItems} />, { wrapper });
    expect(screen.queryAllByRole('button', { name: /rate/i })).toHaveLength(0);
  });
});

describe('UserTitleList – grid mode', () => {
  it('renders a grid container when layout is grid', () => {
    const { container } = render(
      <UserTitleList {...baseProps} items={mockItems} layout="grid" />,
      { wrapper }
    );
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('shows empty state with heading in grid mode when items is empty', () => {
    render(<UserTitleList {...baseProps} items={[]} layout="grid" />, { wrapper });
    expect(screen.getByRole('heading', { name: /My Watchlist/i })).toBeInTheDocument();
    expect(screen.getByText(/Add titles to your watchlist/i)).toBeInTheDocument();
  });

  it('shows type filter pills in grid mode', () => {
    render(<UserTitleList {...baseProps} items={mockItems} layout="grid" />, { wrapper });
    expect(screen.getByRole('tab', { name: 'TV' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Movies' })).toBeInTheDocument();
  });

  it('shows genre pills in grid mode when items have genres', () => {
    render(
      <UserTitleList {...baseProps} items={mixedWithGenres} layout="grid" />,
      { wrapper }
    );
    expect(screen.getByRole('button', { name: 'Mystery' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drama' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sci-Fi' })).toBeInTheDocument();
  });

  it('filters items by type when a type pill is clicked', () => {
    render(
      <UserTitleList {...baseProps} items={mockItems} layout="grid" />,
      { wrapper }
    );
    // Both items visible initially
    expect(screen.getByText('Twin Peaks')).toBeInTheDocument();
    expect(screen.getByText('Inception')).toBeInTheDocument();

    // Click "Movies" tab
    fireEvent.click(screen.getByRole('tab', { name: 'Movies' }));
    expect(screen.queryByText('Twin Peaks')).not.toBeInTheDocument();
    expect(screen.getByText('Inception')).toBeInTheDocument();
  });

  it('resets genre filter when type filter changes', () => {
    render(
      <UserTitleList {...baseProps} items={mixedWithGenres} layout="grid" />,
      { wrapper }
    );
    // Select a genre pill first
    fireEvent.click(screen.getByRole('button', { name: 'Mystery' }));
    // Then change type — genre filter should reset to "all"
    fireEvent.click(screen.getByRole('tab', { name: 'Movies' }));
    // Inception should be visible (genre filter reset)
    expect(screen.getByText('Inception')).toBeInTheDocument();
  });

  it('passes rateTitle to TitleCard in grid mode when provided', () => {
    const rateTitle = vi.fn();
    render(
      <UserTitleList {...baseProps} items={mockItems} layout="grid" rateTitle={rateTitle} />,
      { wrapper }
    );
    const stars = screen.getAllByRole('button', { name: /rate/i });
    expect(stars.length).toBeGreaterThan(0);
  });
});
