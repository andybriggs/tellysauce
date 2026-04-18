import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import StarRating from './StarRating';

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

const mockRateTitle = vi.fn();
const mockIsSubmittingId = vi.fn(() => false);

vi.mock('@/hooks/useRatedTitles', () => ({
  useRatedTitles: vi.fn(() => ({
    isSubmittingId: mockIsSubmittingId,
    rateTitle: mockRateTitle,
  })),
}));

describe('StarRating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSubmittingId.mockReturnValue(false);
  });

  it('renders 5 star buttons', () => {
    render(<StarRating rating={0} titleId={1} titleType="tv" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });

  it('renders correct aria-labels for each star', () => {
    render(<StarRating rating={0} titleId={1} titleType="tv" />);
    expect(screen.getByRole('button', { name: 'Rate 1 star' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rate 2 stars' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rate 3 stars' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rate 4 stars' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rate 5 stars' })).toBeInTheDocument();
  });

  it('calls rateTitle with correct value when a star is clicked', () => {
    render(<StarRating rating={0} titleId={42} titleType="movie" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rate 3 stars' }));
    expect(mockRateTitle).toHaveBeenCalledWith(42, 'movie', 3);
  });

  it('calls rateTitle with value 1 when first star is clicked', () => {
    render(<StarRating rating={0} titleId={10} titleType="tv" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rate 1 star' }));
    expect(mockRateTitle).toHaveBeenCalledWith(10, 'tv', 1);
  });

  it('renders filled stars up to current rating', () => {
    render(<StarRating rating={3} titleId={1} titleType="tv" />);
    // Stars at index 0,1,2 (rating 3) should be filled; 3,4 should be outline
    const filled = screen.getAllByTestId('star-filled');
    const outline = screen.getAllByTestId('star-outline');
    expect(filled).toHaveLength(3);
    expect(outline).toHaveLength(2);
  });

  it('renders all outline stars when rating is 0', () => {
    render(<StarRating rating={0} titleId={1} titleType="tv" />);
    expect(screen.queryAllByTestId('star-filled')).toHaveLength(0);
    expect(screen.getAllByTestId('star-outline')).toHaveLength(5);
  });

  it('renders all filled stars when rating is 5', () => {
    render(<StarRating rating={5} titleId={1} titleType="tv" />);
    expect(screen.getAllByTestId('star-filled')).toHaveLength(5);
    expect(screen.queryAllByTestId('star-outline')).toHaveLength(0);
  });

  it('disables all buttons when isSubmittingId returns true', () => {
    mockIsSubmittingId.mockReturnValue(true);
    render(<StarRating rating={2} titleId={1} titleType="tv" />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('shows loading spinner overlay when submitting', () => {
    mockIsSubmittingId.mockReturnValue(true);
    render(<StarRating rating={2} titleId={1} titleType="tv" />);
    // The spinner div has aria-hidden="true" but we can check it exists via container
    const { container } = render(<StarRating rating={2} titleId={1} titleType="tv" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('does not show loading spinner when not submitting', () => {
    const { container } = render(<StarRating rating={2} titleId={1} titleType="tv" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeNull();
  });
});
