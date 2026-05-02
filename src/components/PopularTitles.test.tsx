import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { SWRConfig } from 'swr';
import PopularTitles from './PopularTitles';
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

vi.mock('./TitleStatusBadge', () => ({
  default: () => null,
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

const mockTitles: Title[] = [
  { id: 1, name: 'Inception', poster: '/inception.jpg', type: 'movie', rating: 0, description: null },
  { id: 2, name: 'Interstellar', poster: '/interstellar.jpg', type: 'movie', rating: 0, description: null },
];

const mockUseDiscoverTitles = vi.fn(() => ({ titles: [], isLoading: false, error: null }));

vi.mock('@/hooks/useDiscoverTitles', () => ({
  useDiscoverTitles: (...args: unknown[]) => mockUseDiscoverTitles(...args),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

describe('PopularTitles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDiscoverTitles.mockReturnValue({ titles: [], isLoading: false, error: null });
  });

  it('renders the TMDB movies section title', () => {
    render(<PopularTitles type="movie" />, { wrapper });
    expect(screen.getByText(/TMDB Popular movies/i)).toBeInTheDocument();
  });

  it('renders the TMDB TV shows section title', () => {
    render(<PopularTitles type="tv" />, { wrapper });
    expect(screen.getByText(/TMDB Popular TV shows/i)).toBeInTheDocument();
  });

  it('renders the AI picks movie title when source is ai', () => {
    render(<PopularTitles type="movie" source="ai" />, { wrapper });
    expect(screen.getByText(/Todays AI picks: Movies/i)).toBeInTheDocument();
  });

  it('renders the AI picks TV title when source is ai', () => {
    render(<PopularTitles type="tv" source="ai" />, { wrapper });
    expect(screen.getByText(/Todays AI picks: TV shows/i)).toBeInTheDocument();
  });

  it('shows timeframe tabs for TMDB source (not ai)', () => {
    // Need titles so the section is not empty (empty state hides the header content)
    mockUseDiscoverTitles.mockReturnValue({ titles: mockTitles, isLoading: false, error: null });
    render(<PopularTitles type="movie" />, { wrapper });
    expect(screen.getByRole('tab', { name: 'Recent' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All time' })).toBeInTheDocument();
  });

  it('hides timeframe tabs when source is ai', () => {
    mockUseDiscoverTitles.mockReturnValue({ titles: mockTitles, isLoading: false, error: null });
    render(<PopularTitles type="movie" source="ai" />, { wrapper });
    expect(screen.queryByRole('tab', { name: 'Recent' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'All time' })).toBeNull();
  });

  it('renders title cards when titles are returned', () => {
    mockUseDiscoverTitles.mockReturnValue({ titles: mockTitles, isLoading: false, error: null });
    render(<PopularTitles type="movie" />, { wrapper });
    expect(screen.getByText('Inception')).toBeInTheDocument();
    expect(screen.getByText('Interstellar')).toBeInTheDocument();
  });

  it('shows empty state message when no titles and source is ai', () => {
    render(<PopularTitles type="movie" source="ai" />, { wrapper });
    expect(screen.getByText(/AI picks refresh daily/i)).toBeInTheDocument();
  });

  it('shows loading text when no titles and source is TMDB', () => {
    render(<PopularTitles type="movie" />, { wrapper });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('calls useDiscoverTitles with correct type and timeframe', () => {
    render(<PopularTitles type="movie" />, { wrapper });
    expect(mockUseDiscoverTitles).toHaveBeenCalledWith('movie', expect.objectContaining({ timeframe: 'recent' }));
  });

  it('calls useDiscoverTitles without timeframe for ai source', () => {
    render(<PopularTitles type="tv" source="ai" />, { wrapper });
    expect(mockUseDiscoverTitles).toHaveBeenCalledWith('tv', expect.objectContaining({ source: 'ai', timeframe: undefined }));
  });

  it('passes initialTitles as initialData to useDiscoverTitles', () => {
    render(<PopularTitles type="movie" source="ai" initialTitles={mockTitles} />, { wrapper });
    expect(mockUseDiscoverTitles).toHaveBeenCalledWith('movie', expect.objectContaining({ initialData: mockTitles }));
  });

  it('switches timeframe when All time tab is clicked', () => {
    mockUseDiscoverTitles.mockReturnValue({ titles: mockTitles, isLoading: false, error: null });
    render(<PopularTitles type="movie" />, { wrapper });
    fireEvent.click(screen.getByRole('tab', { name: 'All time' }));
    expect(mockUseDiscoverTitles).toHaveBeenCalledWith('movie', expect.objectContaining({ timeframe: 'all' }));
  });
});
