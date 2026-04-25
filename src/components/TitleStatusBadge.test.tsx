import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import TitleStatusBadge from './TitleStatusBadge';

vi.mock('@heroicons/react/24/solid', () => ({
  BookmarkIcon: ({ className }: { className?: string }) => (
    <svg data-testid="bookmark-icon" className={className} />
  ),
  StarIcon: ({ className }: { className?: string }) => (
    <svg data-testid="star-icon" className={className} />
  ),
  CheckIcon: ({ className }: { className?: string }) => (
    <svg data-testid="check-icon" className={className} />
  ),
}));

const { mockIsLoggedIn, mockIsInWatchlist, mockIsRated } = vi.hoisted(() => ({
  mockIsLoggedIn: vi.fn(() => true),
  mockIsInWatchlist: vi.fn(() => false),
  mockIsRated: vi.fn(() => false),
}));

vi.mock('@/hooks/useIsLoggedIn', () => ({
  default: mockIsLoggedIn,
}));

vi.mock('@/hooks/useWatchList', () => ({
  useWatchList: vi.fn(() => ({
    isSaved: mockIsInWatchlist,
  })),
}));

vi.mock('@/hooks/useRatedTitles', () => ({
  useRatedTitles: vi.fn(() => ({
    isSaved: mockIsRated,
    getRating: vi.fn(() => 4),
  })),
}));

describe('TitleStatusBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoggedIn.mockReturnValue(true);
    mockIsInWatchlist.mockReturnValue(false);
    mockIsRated.mockReturnValue(false);
  });

  it('renders nothing when user is not logged in', () => {
    mockIsLoggedIn.mockReturnValue(false);
    const { container } = render(<TitleStatusBadge id={1} type="tv" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when title is neither watchlisted nor rated', () => {
    const { container } = render(<TitleStatusBadge id={1} type="tv" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders bookmark and check icons when title is in watchlist', () => {
    mockIsInWatchlist.mockReturnValue(true);
    render(<TitleStatusBadge id={1} type="tv" />);
    expect(screen.getByTestId('bookmark-icon')).toBeInTheDocument();
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('star-icon')).not.toBeInTheDocument();
  });

  it('renders star and check icons when title is rated', () => {
    mockIsRated.mockReturnValue(true);
    render(<TitleStatusBadge id={1} type="movie" />);
    expect(screen.getByTestId('star-icon')).toBeInTheDocument();
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('bookmark-icon')).not.toBeInTheDocument();
  });

  it('shows the rated badge when title is both rated and watchlisted', () => {
    mockIsRated.mockReturnValue(true);
    mockIsInWatchlist.mockReturnValue(true);
    render(<TitleStatusBadge id={1} type="tv" />);
    expect(screen.getByTestId('star-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('bookmark-icon')).not.toBeInTheDocument();
  });

  it('passes id and type correctly to watchlist hook check', () => {
    mockIsInWatchlist.mockReturnValue(true);
    render(<TitleStatusBadge id={42} type="movie" />);
    expect(mockIsInWatchlist).toHaveBeenCalledWith(42, 'movie');
  });

  it('passes id correctly to rated hook check', () => {
    mockIsRated.mockReturnValue(true);
    render(<TitleStatusBadge id={99} type="tv" />);
    expect(mockIsRated).toHaveBeenCalledWith(99);
  });
});
