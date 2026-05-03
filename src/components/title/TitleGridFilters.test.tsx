import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import TitleGridFilters from './TitleGridFilters';
import type { Title } from '@/types';

const mockItems: Title[] = [
  { id: 1, name: 'Breaking Bad', poster: null, type: 'tv', rating: 0, description: null, genres: ['Drama', 'Crime'] },
  { id: 2, name: 'The Dark Knight', poster: null, type: 'movie', rating: 0, description: null, genres: ['Action', 'Drama'] },
  { id: 3, name: 'Inception', poster: null, type: 'movie', rating: 0, description: null, genres: ['Sci-Fi', 'Action'] },
  { id: 4, name: 'Fisk', poster: null, type: 'tv', rating: 0, description: null, genres: ['Comedy'] },
];

const defaultProps = {
  title: '🍿 My Watchlist',
  items: mockItems,
  typeFilter: 'all' as const,
  genreFilter: 'all',
  onTypeChange: vi.fn(),
  onGenreChange: vi.fn(),
  resultCount: 4,
};

describe('TitleGridFilters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the section title', () => {
    render(<TitleGridFilters {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /My Watchlist/i })).toBeInTheDocument();
  });

  it('renders type filter pills (All, TV, Movies)', () => {
    render(<TitleGridFilters {...defaultProps} />);
    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'TV' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Movies' })).toBeInTheDocument();
  });

  it('renders genre pills derived from all items when typeFilter is "all"', () => {
    render(<TitleGridFilters {...defaultProps} />);
    // Genres from all items: Action, Comedy, Crime, Drama, Sci-Fi (sorted, deduplicated)
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drama' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crime' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comedy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sci-Fi' })).toBeInTheDocument();
  });

  it('renders "All" genre pill when genres are present', () => {
    render(<TitleGridFilters {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
  });

  it('only shows genres from TV items when typeFilter is "tv"', () => {
    render(<TitleGridFilters {...defaultProps} typeFilter="tv" />);
    // TV items have Drama, Crime, Comedy
    expect(screen.getByRole('button', { name: 'Drama' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crime' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comedy' })).toBeInTheDocument();
    // Movie-only genres should be absent
    expect(screen.queryByRole('button', { name: 'Action' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sci-Fi' })).not.toBeInTheDocument();
  });

  it('does not render genre pills when items have no genres', () => {
    const noGenreItems: Title[] = [
      { id: 1, name: 'Show', poster: null, type: 'tv', rating: 0, description: null, genres: null },
    ];
    render(<TitleGridFilters {...defaultProps} items={noGenreItems} />);
    // No genre buttons (only type tab buttons should be present)
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3); // All, TV, Movies
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument();
  });

  it('calls onGenreChange when a genre pill is clicked', () => {
    const onGenreChange = vi.fn();
    render(<TitleGridFilters {...defaultProps} onGenreChange={onGenreChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Drama' }));
    expect(onGenreChange).toHaveBeenCalledWith('Drama');
  });

  it('calls onGenreChange with "all" when the All genre pill is clicked', () => {
    const onGenreChange = vi.fn();
    render(<TitleGridFilters {...defaultProps} onGenreChange={onGenreChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onGenreChange).toHaveBeenCalledWith('all');
  });

  it('shows result count on desktop (element present in DOM)', () => {
    render(<TitleGridFilters {...defaultProps} resultCount={7} />);
    expect(screen.getByText('7 titles')).toBeInTheDocument();
  });

  it('shows singular "title" when resultCount is 1', () => {
    render(<TitleGridFilters {...defaultProps} resultCount={1} />);
    expect(screen.getByText('1 title')).toBeInTheDocument();
  });
});
