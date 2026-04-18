import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import TitleCard from './TitleCard';
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
});
