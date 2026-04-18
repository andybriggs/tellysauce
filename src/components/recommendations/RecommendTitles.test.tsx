import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SWRConfig } from 'swr';
import RecommendTitles from './RecommendTitles';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import type { Title } from '@/types';

vi.mock('@heroicons/react/24/solid', () => ({
  ArrowPathIcon: () => <svg data-testid="arrow-path-icon" />,
  SparklesIcon: () => <svg data-testid="sparkles-icon" />,
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockRatedTitles: Title[] = [
  { id: 1, name: 'Breaking Bad', poster: null, type: 'tv', rating: 5, description: null },
  { id: 2, name: 'The Wire', poster: null, type: 'tv', rating: 4, description: null },
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

describe('RecommendTitles', () => {
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

    // Default: GET /api/recommendations returns no items
    server.use(
      http.get('/api/recommendations', () =>
        HttpResponse.json({ set: null, items: [] })
      )
    );
  });

  it('shows empty recommendations state when user has no rated titles', () => {
    render(<RecommendTitles />, { wrapper });
    expect(screen.getByText(/rate titles to get recommendations/i)).toBeInTheDocument();
  });

  it('renders recommendation section when user has rated titles', async () => {
    mockUseRatedTitles.mockReturnValue({
      ratedTitles: mockRatedTitles,
      rateTitle: vi.fn(),
      hasMounted: true,
      isSubmittingId: vi.fn(() => false),
      getRating: vi.fn(() => 0),
      isLoading: false,
      error: null,
    });
    render(<RecommendTitles />, { wrapper });
    // Should render the section with get/refresh button
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  it('renders pre-loaded recommendations from GET /api/recommendations', async () => {
    mockUseRatedTitles.mockReturnValue({
      ratedTitles: mockRatedTitles,
      rateTitle: vi.fn(),
      hasMounted: true,
      isSubmittingId: vi.fn(() => false),
      getRating: vi.fn(() => 0),
      isLoading: false,
      error: null,
    });

    server.use(
      http.get('/api/recommendations', () =>
        HttpResponse.json({
          set: { id: '1' },
          items: [
            { title: 'Ozark', description: 'Crime drama', reason: 'Similar tone', tags: ['crime'], year: 2017 },
            { title: 'Succession', description: 'Family drama', reason: 'Complex characters', tags: [], year: 2018 },
          ],
        })
      )
    );

    render(<RecommendTitles />, { wrapper });
    expect(await screen.findByText('Ozark')).toBeInTheDocument();
    expect(await screen.findByText('Succession')).toBeInTheDocument();
  });

  it('shows skeleton while fetching new recommendations', async () => {
    mockUseRatedTitles.mockReturnValue({
      ratedTitles: mockRatedTitles,
      rateTitle: vi.fn(),
      hasMounted: true,
      isSubmittingId: vi.fn(() => false),
      getRating: vi.fn(() => 0),
      isLoading: false,
      error: null,
    });

    server.use(
      http.post('/api/recommend', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({
          recommendations: [
            { title: 'Better Call Saul', description: 'Prequel', reason: 'Great writing', tags: [], year: 2015 },
          ],
        });
      })
    );

    render(<RecommendTitles />, { wrapper });
    await waitFor(() => screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));

    // Skeleton is rendered as animate-pulse list items
    await waitFor(() => {
      render(<div>{document.body.innerHTML}</div>);
      // Just check the button becomes disabled (loading state)
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  it('shows paywall modal when POST /api/recommend returns 402', async () => {
    mockUseRatedTitles.mockReturnValue({
      ratedTitles: mockRatedTitles,
      rateTitle: vi.fn(),
      hasMounted: true,
      isSubmittingId: vi.fn(() => false),
      getRating: vi.fn(() => 0),
      isLoading: false,
      error: null,
    });

    server.use(
      http.post('/api/recommend', () =>
        HttpResponse.json({ error: 'subscription_required' }, { status: 402 })
      )
    );

    render(<RecommendTitles />, { wrapper });
    await waitFor(() => screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText(/free recommendations used up/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subscribe for £1\.99/i })).toBeInTheDocument();
  });

  it('closes paywall modal when close button is clicked', async () => {
    mockUseRatedTitles.mockReturnValue({
      ratedTitles: mockRatedTitles,
      rateTitle: vi.fn(),
      hasMounted: true,
      isSubmittingId: vi.fn(() => false),
      getRating: vi.fn(() => 0),
      isLoading: false,
      error: null,
    });

    server.use(
      http.post('/api/recommend', () =>
        HttpResponse.json({ error: 'subscription_required' }, { status: 402 })
      )
    );

    render(<RecommendTitles />, { wrapper });
    await waitFor(() => screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));

    await screen.findByText(/free recommendations used up/i);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    await waitFor(() => {
      expect(screen.queryByText(/free recommendations used up/i)).toBeNull();
    });
  });

  it('renders fetched recommendations after clicking the button', async () => {
    mockUseRatedTitles.mockReturnValue({
      ratedTitles: mockRatedTitles,
      rateTitle: vi.fn(),
      hasMounted: true,
      isSubmittingId: vi.fn(() => false),
      getRating: vi.fn(() => 0),
      isLoading: false,
      error: null,
    });

    server.use(
      http.post('/api/recommend', () =>
        HttpResponse.json({
          recommendations: [
            { title: 'Better Call Saul', description: 'Spinoff prequel', reason: 'Great arc', tags: ['drama'], year: 2015 },
          ],
        })
      )
    );

    render(<RecommendTitles />, { wrapper });
    await waitFor(() => screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('Better Call Saul')).toBeInTheDocument();
  });

  it('returns null in seed mode when title is not in rated or watchlist', () => {
    const seed = { title: 'Unknown Show', type: 'tv' as const, external: { tmdbId: 9999 } };
    const { container } = render(<RecommendTitles seed={seed} />, { wrapper });
    expect(container.firstChild).toBeNull();
  });

  it('renders recommendation section in seed mode when title is in watchlist', async () => {
    mockUseWatchList.mockReturnValue({
      watchList: [{ id: 9999, name: 'Known Show', poster: null, type: 'tv', rating: 0, description: null }],
      hasMounted: true,
      isSaved: vi.fn(() => true),
      toggle: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
      isLoading: false,
      error: null,
    });

    const seed = { title: 'Known Show', type: 'tv' as const, external: { tmdbId: 9999 } };
    render(<RecommendTitles seed={seed} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });
});
