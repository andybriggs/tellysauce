import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ExternalLinks from './ExternalLinks';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    target,
  }: {
    href: string;
    children: React.ReactNode;
    target?: string;
  }) => (
    <a href={href} target={target}>
      {children}
    </a>
  ),
}));

describe('ExternalLinks', () => {
  it('renders IMDb link with correct URL', () => {
    render(<ExternalLinks imdbId="tt1234567" />);
    const link = screen.getByRole('link', { name: /imdb/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://www.imdb.com/title/tt1234567/');
  });

  it('renders TMDB link with correct URL', () => {
    render(<ExternalLinks tmdbId={1234} tmdbType="tv" />);
    const link = screen.getByRole('link', { name: /tmdb/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://www.themoviedb.org/tv/1234');
  });

  it('renders nothing when no props are provided', () => {
    const { container } = render(<ExternalLinks />);
    expect(container.firstChild).toBeNull();
  });

  it('hides TMDB link when only tmdbId is provided without tmdbType', () => {
    render(<ExternalLinks tmdbId={1234} />);
    expect(screen.queryByText('TMDB')).toBeNull();
  });

  it('hides TMDB link when only tmdbType is provided without tmdbId', () => {
    render(<ExternalLinks tmdbType="movie" />);
    expect(screen.queryByText('TMDB')).toBeNull();
  });

  it('renders both IMDb and TMDB links together', () => {
    render(<ExternalLinks imdbId="tt9999999" tmdbId={999} tmdbType="movie" />);
    expect(screen.getByText('IMDb')).toBeInTheDocument();
    expect(screen.getByText('TMDB')).toBeInTheDocument();
  });

  it('renders IMDb rating when provided', () => {
    render(<ExternalLinks imdbId="tt1234567" imdbRating="8.5" />);
    expect(screen.getByText(/8\.5/)).toBeInTheDocument();
  });

  it('shows rating unavailable when IMDb rating is missing', () => {
    render(<ExternalLinks imdbId="tt1234567" />);
    expect(screen.getByText(/rating unavailable/i)).toBeInTheDocument();
  });
});
