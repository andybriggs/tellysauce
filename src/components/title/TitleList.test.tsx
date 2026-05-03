import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import TitleList from './TitleList';
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
  default: ({ id }: { id: number }) => (
    <div data-testid={`title-status-badge-${id}`} />
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

const mockTitles: Title[] = [
  { id: 1, name: 'Breaking Bad', poster: '/bb.jpg', type: 'tv', rating: 0, description: null },
  { id: 2, name: 'The Wire', poster: '/wire.jpg', type: 'tv', rating: 0, description: null },
  { id: 3, name: 'Sopranos', poster: '/sopranos.jpg', type: 'tv', rating: 0, description: null },
];

describe('TitleList', () => {
  it('renders all title cards in carousel mode', () => {
    render(<TitleList items={mockTitles} layout="carousel" />);
    expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
    expect(screen.getByText('The Wire')).toBeInTheDocument();
    expect(screen.getByText('Sopranos')).toBeInTheDocument();
  });

  it('renders all title cards in grid mode', () => {
    render(<TitleList items={mockTitles} layout="grid" />);
    expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
    expect(screen.getByText('The Wire')).toBeInTheDocument();
    expect(screen.getByText('Sopranos')).toBeInTheDocument();
  });

  it('renders scroll buttons in carousel mode', () => {
    render(<TitleList items={mockTitles} layout="carousel" />);
    expect(screen.getByRole('button', { name: 'Scroll left' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scroll right' })).toBeInTheDocument();
  });

  it('does not render scroll buttons in grid mode', () => {
    render(<TitleList items={mockTitles} layout="grid" />);
    expect(screen.queryByRole('button', { name: 'Scroll left' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scroll right' })).toBeNull();
  });

  it('renders correct number of list items in grid mode', () => {
    const { container } = render(<TitleList items={mockTitles} layout="grid" />);
    const lis = container.querySelectorAll('ul > li');
    expect(lis).toHaveLength(3);
  });

  it('renders correct number of list items in carousel mode', () => {
    const { container } = render(<TitleList items={mockTitles} layout="carousel" />);
    const lis = container.querySelectorAll('ul > li');
    expect(lis).toHaveLength(3);
  });

  it('renders nothing in the list when items array is empty', () => {
    const { container } = render(<TitleList items={[]} layout="carousel" />);
    const lis = container.querySelectorAll('ul > li');
    expect(lis).toHaveLength(0);
  });

  it('uses renderItem prop when provided', () => {
    const renderItem = vi.fn((t: Title) => <div data-testid={`custom-${t.id}`}>{t.name}</div>);
    render(<TitleList items={mockTitles} layout="grid" renderItem={renderItem} />);
    expect(screen.getByTestId('custom-1')).toBeInTheDocument();
    expect(renderItem).toHaveBeenCalledTimes(3);
  });

  it('passes "grid" as layout argument to renderItem in grid mode', () => {
    const renderItem = vi.fn((t: Title) => <div data-testid={`custom-${t.id}`}>{t.name}</div>);
    render(<TitleList items={mockTitles} layout="grid" renderItem={renderItem} />);
    expect(renderItem).toHaveBeenCalledWith(expect.any(Object), 'grid');
  });

  it('passes "carousel" as layout argument to renderItem in carousel mode', () => {
    const renderItem = vi.fn((t: Title) => <div data-testid={`custom-${t.id}`}>{t.name}</div>);
    render(<TitleList items={mockTitles} layout="carousel" renderItem={renderItem} />);
    expect(renderItem).toHaveBeenCalledWith(expect.any(Object), 'carousel');
  });

  it('grid list items have aspect-ratio and full-width classes', () => {
    const { container } = render(<TitleList items={mockTitles} layout="grid" />);
    const lis = container.querySelectorAll('ul > li');
    lis.forEach((li) => {
      expect(li.className).toContain('aspect-[3/4]');
      expect(li.className).toContain('w-full');
    });
  });

  it('defaults to carousel layout when layout prop is not provided', () => {
    render(<TitleList items={mockTitles} />);
    expect(screen.getByRole('button', { name: 'Scroll left' })).toBeInTheDocument();
  });

  it('does not render status badges when showStatusOverlay is not set', () => {
    render(<TitleList items={mockTitles} layout="carousel" />);
    expect(screen.queryByTestId('title-status-badge-1')).not.toBeInTheDocument();
  });

  it('renders status badges on all cards when showStatusOverlay is true', () => {
    render(<TitleList items={mockTitles} layout="carousel" showStatusOverlay />);
    expect(screen.getByTestId('title-status-badge-1')).toBeInTheDocument();
    expect(screen.getByTestId('title-status-badge-2')).toBeInTheDocument();
    expect(screen.getByTestId('title-status-badge-3')).toBeInTheDocument();
  });

  it('renders status badges in grid mode when showStatusOverlay is true', () => {
    render(<TitleList items={mockTitles} layout="grid" showStatusOverlay />);
    expect(screen.getByTestId('title-status-badge-1')).toBeInTheDocument();
    expect(screen.getByTestId('title-status-badge-2')).toBeInTheDocument();
    expect(screen.getByTestId('title-status-badge-3')).toBeInTheDocument();
  });

  it('does not render status badges when renderItem is provided even with showStatusOverlay', () => {
    const renderItem = vi.fn((t: Title) => <div data-testid={`custom-${t.id}`}>{t.name}</div>);
    render(<TitleList items={mockTitles} layout="grid" renderItem={renderItem} showStatusOverlay />);
    expect(screen.queryByTestId('title-status-badge-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('custom-1')).toBeInTheDocument();
  });
});
