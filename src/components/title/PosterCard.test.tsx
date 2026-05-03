import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import PosterCard from './PosterCard';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

describe('PosterCard', () => {
  it('renders image when posterUrl is provided', () => {
    render(<PosterCard posterUrl="https://example.com/poster.jpg" title="Breaking Bad" />);
    const img = screen.getByAltText('Breaking Bad poster');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/poster.jpg');
  });

  it('renders placeholder text when posterUrl is not provided', () => {
    render(<PosterCard title="Unknown Show" />);
    expect(screen.getByText('No image')).toBeInTheDocument();
  });

  it('does not render img element when posterUrl is missing', () => {
    render(<PosterCard title="Unknown Show" />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('uses title in alt text for the image', () => {
    render(<PosterCard posterUrl="/poster.jpg" title="The Wire" />);
    expect(screen.getByAltText('The Wire poster')).toBeInTheDocument();
  });
});
