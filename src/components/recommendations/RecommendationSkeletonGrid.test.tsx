import { render } from '@testing-library/react';
import RecommendationSkeletonGrid from './RecommendationSkeletonGrid';

describe('RecommendationSkeletonGrid', () => {
  it('renders the default count of 6 skeleton items', () => {
    const { container } = render(<RecommendationSkeletonGrid />);
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(6);
  });

  it('renders the correct number of skeleton items when count is provided', () => {
    const { container } = render(<RecommendationSkeletonGrid count={3} />);
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(3);
  });

  it('renders skeleton pulse animation elements', () => {
    const { container } = render(<RecommendationSkeletonGrid count={2} />);
    const pulsing = container.querySelectorAll('.animate-pulse');
    expect(pulsing).toHaveLength(2);
  });

  it('renders a list element', () => {
    const { container } = render(<RecommendationSkeletonGrid />);
    expect(container.querySelector('ul')).toBeInTheDocument();
  });

  it('renders 1 skeleton item when count is 1', () => {
    const { container } = render(<RecommendationSkeletonGrid count={1} />);
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(1);
  });
});
