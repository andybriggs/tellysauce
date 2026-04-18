import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import TitleActions from './TitleActions';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock('@heroicons/react/24/solid', () => ({
  StarIcon: ({ className }: { className?: string }) => (
    <svg data-testid="star-filled" className={className} />
  ),
  BookmarkIcon: ({ className }: { className?: string }) => (
    <svg data-testid="bookmark-icon" className={className} />
  ),
}));

vi.mock('@heroicons/react/24/outline', () => ({
  StarIcon: ({ className }: { className?: string }) => (
    <svg data-testid="star-outline" className={className} />
  ),
}));

const mockGetRating = vi.fn(() => 0);
const mockRateTitle = vi.fn();
const mockIsSubmittingId = vi.fn(() => false);

vi.mock('@/hooks/useRatedTitles', () => ({
  useRatedTitles: vi.fn(() => ({
    hasMounted: true,
    getRating: mockGetRating,
    rateTitle: mockRateTitle,
    isSubmittingId: mockIsSubmittingId,
  })),
}));

const mockToggle = vi.fn();
const mockIsSaved = vi.fn(() => false);

vi.mock('@/hooks/useWatchList', () => ({
  useWatchList: vi.fn(() => ({
    hasMounted: true,
    isSaved: mockIsSaved,
    toggle: mockToggle,
  })),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

const mockTitle = {
  id: 1,
  name: 'Breaking Bad',
  poster: '/poster.jpg',
  type: 'tv' as const,
  description: 'A drama.',
};

describe('TitleActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRating.mockReturnValue(0);
    mockIsSubmittingId.mockReturnValue(false);
    mockIsSaved.mockReturnValue(false);
  });

  it('shows login prompt when unauthenticated', () => {
    render(<TitleActions title={mockTitle} />);
    expect(screen.getByText(/log in to rate and save/i)).toBeInTheDocument();
  });

  it('renders AuthButton when unauthenticated', () => {
    render(<TitleActions title={mockTitle} />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders star rating when authenticated', async () => {
    const { useSession } = await import('next-auth/react');
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { user: { name: 'Alice' } },
      status: 'authenticated',
    });
    render(<TitleActions title={mockTitle} />);
    const stars = screen.getAllByRole('button', { name: /rate/i });
    expect(stars).toHaveLength(5);
  });

  it('renders watchlist button when authenticated and unrated', async () => {
    const { useSession } = await import('next-auth/react');
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { user: { name: 'Alice' } },
      status: 'authenticated',
    });
    mockGetRating.mockReturnValue(0);
    render(<TitleActions title={mockTitle} />);
    expect(screen.getByText('Add to watchlist')).toBeInTheDocument();
  });

  it('hides watchlist button when title is already rated', async () => {
    const { useSession } = await import('next-auth/react');
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { user: { name: 'Alice' } },
      status: 'authenticated',
    });
    mockGetRating.mockReturnValue(4);
    render(<TitleActions title={mockTitle} />);
    expect(screen.queryByText('Add to watchlist')).toBeNull();
    expect(screen.queryByText('Remove from watchlist')).toBeNull();
  });
});
