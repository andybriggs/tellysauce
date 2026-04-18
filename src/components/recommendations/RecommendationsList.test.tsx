import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import RecommendationsList from './RecommendationsList';
import type { Recommendation } from '@/types';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    'aria-label': ariaLabel,
  }: {
    href: string;
    children: React.ReactNode;
    'aria-label'?: string;
  }) => (
    <a href={href} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

vi.mock('@heroicons/react/24/solid', () => ({
  SparklesIcon: () => <svg data-testid="sparkles-icon" />,
}));

const recommendations: Recommendation[] = [
  { title: 'Breaking Bad', description: 'A teacher turned drug lord.', reason: 'Great drama.' },
  { title: 'The Wire', description: 'Urban crime drama.', reason: 'Critically acclaimed.' },
];

describe('RecommendationsList', () => {
  it('renders all recommendation cards', () => {
    render(<RecommendationsList items={recommendations} />);
    expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
    expect(screen.getByText('The Wire')).toBeInTheDocument();
  });

  it('renders descriptions for each card', () => {
    render(<RecommendationsList items={recommendations} />);
    expect(screen.getByText('A teacher turned drug lord.')).toBeInTheDocument();
    expect(screen.getByText('Urban crime drama.')).toBeInTheDocument();
  });

  it('renders an empty list when items array is empty', () => {
    const { container } = render(<RecommendationsList items={[]} />);
    const list = container.querySelector('ul');
    expect(list).toBeInTheDocument();
    expect(list?.children).toHaveLength(0);
  });

  it('renders correct number of list items', () => {
    const { container } = render(<RecommendationsList items={recommendations} />);
    const listItems = container.querySelectorAll('li');
    expect(listItems).toHaveLength(2);
  });
});
