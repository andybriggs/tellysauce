import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import TitleCard from './TitleCard';
import type { Title } from '@/types';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

vi.mock('@heroicons/react/24/solid', () => ({
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
  default: ({ id, type }: { id: number; type: string }) => (
    <div data-testid="title-status-badge" data-id={String(id)} data-type={type} />
  ),
}));

const mockTitle: Title = {
  id: 42,
  name: 'Twin Peaks',
  poster: '/twin-peaks.jpg',
  type: 'tv',
  rating: 0,
  description: 'Mystery drama.',
};

describe('TitleCard', () => {
  it('renders the title name', () => {
    render(<TitleCard title={mockTitle} />);
    expect(screen.getByText('Twin Peaks')).toBeInTheDocument();
  });

  it('renders the poster image', () => {
    render(<TitleCard title={mockTitle} />);
    expect(screen.getByRole('img', { name: 'Twin Peaks' })).toHaveAttribute('src', '/twin-peaks.jpg');
  });

  it('links to the correct URL', () => {
    render(<TitleCard title={mockTitle} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/title/tv/42');
  });

  it('renders a fallback div when poster is null', () => {
    const noPoster: Title = { ...mockTitle, poster: null };
    const { container } = render(<TitleCard title={noPoster} />);
    expect(screen.queryByRole('img')).toBeNull();
    // fallback slate div
    expect(container.querySelector('.bg-slate-800')).toBeInTheDocument();
  });

  it('does not render star rating when rateTitle prop is not provided', () => {
    render(<TitleCard title={mockTitle} />);
    expect(screen.queryAllByRole('button', { name: /rate/i })).toHaveLength(0);
  });

  it('renders star rating buttons when rateTitle prop is provided', () => {
    const rateTitle = vi.fn();
    render(<TitleCard title={{ ...mockTitle, rating: 3 }} rateTitle={rateTitle} />);
    const stars = screen.getAllByRole('button', { name: /rate/i });
    expect(stars).toHaveLength(5);
  });

  it('shows the correct rating in star rating when rateTitle is provided', () => {
    const rateTitle = vi.fn();
    render(<TitleCard title={{ ...mockTitle, rating: 3 }} rateTitle={rateTitle} />);
    expect(screen.getAllByTestId('star-filled')).toHaveLength(3);
    expect(screen.getAllByTestId('star-outline')).toHaveLength(2);
  });

  it('does not render status badge when showStatusOverlay is not set', () => {
    render(<TitleCard title={mockTitle} />);
    expect(screen.queryByTestId('title-status-badge')).not.toBeInTheDocument();
  });

  it('renders status badge with correct props when showStatusOverlay is true', () => {
    render(<TitleCard title={mockTitle} showStatusOverlay />);
    const badge = screen.getByTestId('title-status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-id', '42');
    expect(badge).toHaveAttribute('data-type', 'tv');
  });

  it('applies fixed size classes when fill is not set', () => {
    const { container } = render(<TitleCard title={mockTitle} />);
    const link = container.querySelector('a')!;
    const card = link.firstElementChild!;
    expect(link.className).toContain('flex-none');
    expect(card.className).toContain('w-48');
    expect(card.className).toContain('h-64');
  });

  it('applies fill size classes when fill prop is true', () => {
    const { container } = render(<TitleCard title={mockTitle} fill />);
    const link = container.querySelector('a')!;
    const card = link.firstElementChild!;
    expect(link.className).toContain('w-full');
    expect(link.className).toContain('h-full');
    expect(card.className).toContain('w-full');
    expect(card.className).toContain('h-full');
    expect(link.className).not.toContain('flex-none');
    expect(card.className).not.toContain('w-48');
  });
});
