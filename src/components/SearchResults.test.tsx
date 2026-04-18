import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import SearchResults from './SearchResults';
import type { AutoCompleteResult } from '@/types';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockResults: AutoCompleteResult[] = [
  { id: 1, name: 'Twin Peaks', type: 'tv', poster: '/twin-peaks.jpg', year: 1990 },
  { id: 2, name: 'Breaking Bad', type: 'tv', poster: '/bb.jpg', year: 2008 },
];

describe('SearchResults', () => {
  it('renders all results', () => {
    render(<SearchResults data={mockResults} />);
    expect(screen.getByText('Twin Peaks')).toBeInTheDocument();
    expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
  });

  it('renders "No results" when data array is empty', () => {
    render(<SearchResults data={[]} />);
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('each result links to the correct URL', () => {
    render(<SearchResults data={mockResults} />);
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/title/tv/1');
    expect(links[1]).toHaveAttribute('href', '/title/tv/2');
  });

  it('renders correct number of result links', () => {
    render(<SearchResults data={mockResults} />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('renders poster images when poster is provided', () => {
    render(<SearchResults data={mockResults} />);
    expect(screen.getByRole('img', { name: 'Twin Peaks' })).toBeInTheDocument();
  });

  it('does not render an img when poster is null', () => {
    const noPoster: AutoCompleteResult[] = [
      { id: 3, name: 'No Poster Show', type: 'tv', poster: null },
    ];
    render(<SearchResults data={noPoster} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders a shimmer placeholder before image loads', () => {
    const { container } = render(<SearchResults data={mockResults} />);
    // Shimmer div is rendered before image loads (loaded state starts false)
    // The shimmer div has a gradient class
    const shimmer = container.querySelector('.animate-\\[shimmer_1\\.2s_linear_infinite\\]');
    expect(shimmer).toBeInTheDocument();
  });
});
