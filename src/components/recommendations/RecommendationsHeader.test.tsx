import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import RecommendationsHeader from './RecommendationsHeader';

vi.mock('@heroicons/react/24/solid', () => ({
  ArrowPathIcon: () => <svg data-testid="arrow-path-icon" />,
  SparklesIcon: () => <svg data-testid="sparkles-icon" />,
}));

describe('RecommendationsHeader', () => {
  const defaultProps = {
    onClick: vi.fn(),
    isLoading: false,
    canRun: true,
    hasResults: false,
    label: 'Smart picks for you',
  };

  it('renders the heading label', () => {
    render(<RecommendationsHeader {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Smart picks for you');
  });

  it('renders the refresh button', () => {
    render(<RecommendationsHeader {...defaultProps} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onClick when the button is clicked', () => {
    const onClick = vi.fn();
    render(<RecommendationsHeader {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading spinner when isLoading is true', () => {
    render(<RecommendationsHeader {...defaultProps} isLoading={true} />);
    expect(screen.getByTestId('arrow-path-icon')).toBeInTheDocument();
  });

  it('shows sparkles icon when not loading', () => {
    render(<RecommendationsHeader {...defaultProps} isLoading={false} />);
    expect(screen.getByTestId('sparkles-icon')).toBeInTheDocument();
  });

  it('disables the button when canRun is false', () => {
    render(<RecommendationsHeader {...defaultProps} canRun={false} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables the button when isLoading is true', () => {
    render(<RecommendationsHeader {...defaultProps} isLoading={true} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows "Get Recommendations" text when hasResults is false', () => {
    render(<RecommendationsHeader {...defaultProps} hasResults={false} />);
    // There are two spans (one hidden on mobile), check both contain "Get"
    const spans = screen.getAllByText(/get recommendations/i);
    expect(spans.length).toBeGreaterThan(0);
  });

  it('shows "Refresh Recommendations" text when hasResults is true', () => {
    render(<RecommendationsHeader {...defaultProps} hasResults={true} />);
    const spans = screen.getAllByText(/refresh recommendations/i);
    expect(spans.length).toBeGreaterThan(0);
  });

  it('renders "Based on your rated titles" subtext', () => {
    render(<RecommendationsHeader {...defaultProps} />);
    expect(screen.getByText(/based on your rated titles/i)).toBeInTheDocument();
  });

  it('uses default label when label is undefined', () => {
    render(
      <RecommendationsHeader
        onClick={vi.fn()}
        isLoading={false}
        canRun={true}
        hasResults={false}
        label={undefined}
      />
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Smart picks for you');
  });
});
