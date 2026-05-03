import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ExternalLinks from './ExternalLinks';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    target,
    title,
  }: {
    href: string;
    children: React.ReactNode;
    target?: string;
    title?: string;
  }) => (
    <a href={href} target={target} title={title}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, className }: {
    src: string;
    alt: string;
    width: number;
    height: number;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}));

describe('ExternalLinks', () => {
  it('renders nothing when no props are provided', () => {
    const { container } = render(<ExternalLinks />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when only RT props are absent and no imdbId', () => {
    const { container } = render(<ExternalLinks rtRating="92%" />);
    // rtRating alone still renders the RT link
    expect(container.firstChild).not.toBeNull();
  });

  it('renders IMDb link with correct URL', () => {
    render(<ExternalLinks imdbId="tt1234567" />);
    const link = screen.getByRole('link', { name: /imdb/i });
    expect(link).toHaveAttribute('href', 'https://www.imdb.com/title/tt1234567/');
  });

  it('renders IMDb link with title attribute', () => {
    render(<ExternalLinks imdbId="tt1234567" />);
    expect(screen.getByRole('link', { name: /imdb/i })).toHaveAttribute('title', 'View on IMDb');
  });

  it('renders IMDb rating when provided', () => {
    render(<ExternalLinks imdbId="tt1234567" imdbRating="8.5" />);
    expect(screen.getByText(/8\.5/)).toBeInTheDocument();
  });

  it('shows rating unavailable when IMDb rating is absent', () => {
    render(<ExternalLinks imdbId="tt1234567" />);
    expect(screen.getByText(/rating unavailable/i)).toBeInTheDocument();
  });

  it('renders RT link with search URL', () => {
    render(<ExternalLinks rtRating="92%" rtSearchTitle="Breaking Bad" />);
    const link = screen.getByRole('link', { name: /rotten tomatoes/i });
    expect(link).toHaveAttribute(
      'href',
      'https://www.rottentomatoes.com/search?search=Breaking%20Bad'
    );
  });

  it('renders RT link with title attribute', () => {
    render(<ExternalLinks rtRating="92%" rtSearchTitle="Breaking Bad" />);
    expect(screen.getByRole('link', { name: /rotten tomatoes/i })).toHaveAttribute(
      'title',
      'View on Rotten Tomatoes'
    );
  });

  it('renders RT rating percentage', () => {
    render(<ExternalLinks rtRating="92%" rtSearchTitle="Breaking Bad" />);
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('does not render RT link when rtRating is absent', () => {
    render(<ExternalLinks imdbId="tt1234567" />);
    expect(screen.queryByRole('link', { name: /rotten tomatoes/i })).toBeNull();
  });

  it('renders both IMDb and RT links together', () => {
    render(
      <ExternalLinks
        imdbId="tt9999999"
        imdbRating="9.0"
        rtRating="97%"
        rtSearchTitle="The Wire"
      />
    );
    expect(screen.getByRole('link', { name: /imdb/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /rotten tomatoes/i })).toBeInTheDocument();
  });

  it('does not render TMDB link', () => {
    render(<ExternalLinks imdbId="tt1234567" />);
    expect(screen.queryByRole('link', { name: /tmdb/i })).toBeNull();
  });

  it('opens links in a new tab', () => {
    render(<ExternalLinks imdbId="tt1234567" rtRating="80%" rtSearchTitle="Test" />);
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
    }
  });
});
