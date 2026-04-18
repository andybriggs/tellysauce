import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import RecommendationCard from './RecommendationCard';
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

const baseRec: Recommendation & { year?: number } = {
  title: 'Severance',
  tags: ['Sci-Fi', 'Thriller'],
  description: 'A gripping workplace mystery.',
  reason: "You'll like it because you enjoy mysteries.",
  year: 2022,
};

describe('RecommendationCard', () => {
  it('renders the title', () => {
    render(<ul><RecommendationCard rec={baseRec} /></ul>);
    expect(screen.getByText('Severance')).toBeInTheDocument();
  });

  it('renders the reason text', () => {
    render(<ul><RecommendationCard rec={baseRec} /></ul>);
    expect(
      screen.getByText("You'll like it because you enjoy mysteries.")
    ).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(<ul><RecommendationCard rec={baseRec} /></ul>);
    expect(screen.getByText('A gripping workplace mystery.')).toBeInTheDocument();
  });

  it('renders tags', () => {
    render(<ul><RecommendationCard rec={baseRec} /></ul>);
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument();
    expect(screen.getByText('Thriller')).toBeInTheDocument();
  });

  it('renders year when provided', () => {
    render(<ul><RecommendationCard rec={baseRec} /></ul>);
    expect(screen.getByLabelText('Year 2022')).toBeInTheDocument();
  });

  it('renders the AI pick badge', () => {
    render(<ul><RecommendationCard rec={baseRec} /></ul>);
    expect(screen.getByText('AI pick')).toBeInTheDocument();
  });

  it('renders a link with the title in aria-label', () => {
    render(<ul><RecommendationCard rec={baseRec} /></ul>);
    const link = screen.getByRole('link');
    expect(link.getAttribute('aria-label')).toMatch(/Severance/);
  });

  it('renders without crashing when optional fields are missing', () => {
    const minimal: Recommendation = { title: 'Minimal Show' };
    render(<ul><RecommendationCard rec={minimal} /></ul>);
    expect(screen.getByText('Minimal Show')).toBeInTheDocument();
  });
});
