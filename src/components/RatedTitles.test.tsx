import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SWRConfig } from 'swr';
import RatedTitles from './RatedTitles';
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

const mockRatedTitles: Title[] = [
  { id: 1, name: 'Breaking Bad', poster: '/bb.jpg', type: 'tv', rating: 5, description: null },
  { id: 2, name: 'The Wire', poster: '/tw.jpg', type: 'tv', rating: 4, description: null },
];

const mockUseRatedTitles = vi.fn(() => ({
  ratedTitles: [] as Title[],
  rateTitle: vi.fn(),
  hasMounted: true,
  isSubmittingId: vi.fn(() => false),
  getRating: vi.fn(() => 0),
  isLoading: false,
  error: null,
}));

vi.mock('@/hooks/useRatedTitles', () => ({
  useRatedTitles: (...args: unknown[]) => mockUseRatedTitles(...args),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

describe('RatedTitles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRatedTitles.mockReturnValue({
      ratedTitles: [],
      rateTitle: vi.fn(),
      hasMounted: true,
      isSubmittingId: vi.fn(() => false),
      getRating: vi.fn(() => 0),
      isLoading: false,
      error: null,
    });
  });

  it('renders the rated titles section title', () => {
    render(<RatedTitles />, { wrapper });
    expect(screen.getByText(/My Rated Titles/i)).toBeInTheDocument();
  });

  it('shows empty state when no titles are rated', () => {
    render(<RatedTitles />, { wrapper });
    expect(screen.getByText(/Search and rate some titles/i)).toBeInTheDocument();
  });

  it('renders rated title cards when titles are present', () => {
    mockUseRatedTitles.mockReturnValue({
      ratedTitles: mockRatedTitles,
      rateTitle: vi.fn(),
      hasMounted: true,
      isSubmittingId: vi.fn(() => false),
      getRating: vi.fn((id: number) => mockRatedTitles.find((t) => t.id === id)?.rating ?? 0),
      isLoading: false,
      error: null,
    });
    render(<RatedTitles />, { wrapper });
    expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
    expect(screen.getByText('The Wire')).toBeInTheDocument();
  });

  it('passes rateTitle to TitleCard when rendering rated items', () => {
    mockUseRatedTitles.mockReturnValue({
      ratedTitles: mockRatedTitles,
      rateTitle: vi.fn(),
      hasMounted: true,
      isSubmittingId: vi.fn(() => false),
      getRating: vi.fn(() => 0),
      isLoading: false,
      error: null,
    });
    render(<RatedTitles />, { wrapper });
    // Star rating buttons should be present since rateTitle is passed to TitleCard
    const stars = screen.getAllByRole('button', { name: /rate/i });
    expect(stars.length).toBeGreaterThan(0);
  });

  it('renders in grid layout when layout prop is grid', () => {
    mockUseRatedTitles.mockReturnValue({
      ratedTitles: mockRatedTitles,
      rateTitle: vi.fn(),
      hasMounted: true,
      isSubmittingId: vi.fn(() => false),
      getRating: vi.fn(() => 0),
      isLoading: false,
      error: null,
    });
    const { container } = render(<RatedTitles layout="grid" />, { wrapper });
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });
});
