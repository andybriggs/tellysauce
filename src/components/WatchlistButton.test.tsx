import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import WatchlistButton from './WatchlistButton';

vi.mock('@heroicons/react/24/solid', () => ({
  BookmarkIcon: ({ className }: { className?: string }) => (
    <svg data-testid="bookmark-icon" className={className} />
  ),
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

const mockTitle = {
  id: 123,
  name: 'Breaking Bad',
  poster: '/poster.jpg',
  type: 'tv' as const,
  description: 'A drama.',
};

describe('WatchlistButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSaved.mockReturnValue(false);
  });

  it('renders "Add to watchlist" when not saved', () => {
    render(<WatchlistButton title={mockTitle} />);
    expect(screen.getByText('Add to watchlist')).toBeInTheDocument();
  });

  it('renders "Remove from watchlist" when saved', () => {
    mockIsSaved.mockReturnValue(true);
    render(<WatchlistButton title={mockTitle} />);
    expect(screen.getByText('Remove from watchlist')).toBeInTheDocument();
  });

  it('has aria-pressed=false when not saved', () => {
    render(<WatchlistButton title={mockTitle} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('has aria-pressed=true when saved', () => {
    mockIsSaved.mockReturnValue(true);
    render(<WatchlistButton title={mockTitle} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls toggle with the title when clicked', () => {
    render(<WatchlistButton title={mockTitle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockToggle).toHaveBeenCalledWith(mockTitle);
  });

  it('is disabled and shows "Title not available" title when no id', () => {
    const titleNoId = { name: 'Unknown', poster: null, type: 'tv' as const, description: null } as any;
    render(<WatchlistButton title={titleNoId} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', 'Title not available');
  });

  it('renders the bookmark icon', () => {
    render(<WatchlistButton title={mockTitle} />);
    expect(screen.getByTestId('bookmark-icon')).toBeInTheDocument();
  });

  it('does not call toggle when title has no valid id', () => {
    const titleNoId = { name: 'Unknown', poster: null, type: 'tv' as const, description: null } as any;
    render(<WatchlistButton title={titleNoId} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockToggle).not.toHaveBeenCalled();
  });
});
