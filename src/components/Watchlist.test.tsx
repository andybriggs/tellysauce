import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SWRConfig } from 'swr';
import Watchlist from './Watchlist';
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

const mockWatchList: Title[] = [
  { id: 1, name: 'Twin Peaks', poster: '/tp.jpg', type: 'tv', rating: 0, description: null },
  { id: 2, name: 'The Sopranos', poster: '/ts.jpg', type: 'tv', rating: 0, description: null },
];

const mockUseWatchList = vi.fn(() => ({
  watchList: [] as Title[],
  hasMounted: true,
  isSaved: vi.fn(() => false),
  toggle: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  isLoading: false,
  error: null,
}));

vi.mock('@/hooks/useWatchList', () => ({
  useWatchList: (...args: unknown[]) => mockUseWatchList(...args),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

describe('Watchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWatchList.mockReturnValue({
      watchList: [],
      hasMounted: true,
      isSaved: vi.fn(() => false),
      toggle: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
      isLoading: false,
      error: null,
    });
  });

  it('renders the watchlist section title', () => {
    render(<Watchlist />, { wrapper });
    expect(screen.getByText(/My Watchlist/i)).toBeInTheDocument();
  });

  it('shows empty state when watchlist is empty', () => {
    render(<Watchlist />, { wrapper });
    expect(screen.getByText(/Add titles to your watchlist/i)).toBeInTheDocument();
  });

  it('renders watchlist items when watchlist has titles', () => {
    mockUseWatchList.mockReturnValue({
      watchList: mockWatchList,
      hasMounted: true,
      isSaved: vi.fn(() => false),
      toggle: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
      isLoading: false,
      error: null,
    });
    render(<Watchlist />, { wrapper });
    expect(screen.getByText('Twin Peaks')).toBeInTheDocument();
    expect(screen.getByText('The Sopranos')).toBeInTheDocument();
  });

  it('renders correct number of title cards', () => {
    mockUseWatchList.mockReturnValue({
      watchList: mockWatchList,
      hasMounted: true,
      isSaved: vi.fn(() => false),
      toggle: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
      isLoading: false,
      error: null,
    });
    render(<Watchlist />, { wrapper });
    const links = screen.getAllByRole('link');
    // Each card has one link; section header may add one more (View All)
    expect(links.length).toBeGreaterThanOrEqual(2);
  });

  it('renders in grid layout when layout prop is grid', () => {
    mockUseWatchList.mockReturnValue({
      watchList: mockWatchList,
      hasMounted: true,
      isSaved: vi.fn(() => false),
      toggle: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
      isLoading: false,
      error: null,
    });
    const { container } = render(<Watchlist layout="grid" />, { wrapper });
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('shows type filter pills in grid mode', () => {
    mockUseWatchList.mockReturnValue({
      watchList: mockWatchList,
      hasMounted: true,
      isSaved: vi.fn(() => false),
      toggle: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
      isLoading: false,
      error: null,
    });
    render(<Watchlist layout="grid" />, { wrapper });
    expect(screen.getByRole('tab', { name: 'TV' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Movies' })).toBeInTheDocument();
  });

  it('shows empty state with heading in grid mode when watchlist is empty', () => {
    render(<Watchlist layout="grid" />, { wrapper });
    expect(screen.getByRole('heading', { name: /My Watchlist/i })).toBeInTheDocument();
    expect(screen.getByText(/Add titles to your watchlist/i)).toBeInTheDocument();
  });

  it('shows genre pills in grid mode when items have genres', () => {
    const withGenres: Title[] = [
      { id: 1, name: 'Twin Peaks', poster: null, type: 'tv', rating: 0, description: null, genres: ['Mystery', 'Drama'] },
    ];
    mockUseWatchList.mockReturnValue({
      watchList: withGenres,
      hasMounted: true,
      isSaved: vi.fn(() => false),
      toggle: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
      isLoading: false,
      error: null,
    });
    render(<Watchlist layout="grid" />, { wrapper });
    expect(screen.getByRole('button', { name: 'Mystery' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drama' })).toBeInTheDocument();
  });
});
