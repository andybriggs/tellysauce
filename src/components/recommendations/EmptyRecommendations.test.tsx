import { render, screen } from '@testing-library/react';
import EmptyRecommendations from './EmptyRecommendations';

describe('EmptyRecommendations', () => {
  it('renders the Recommendations heading', () => {
    render(<EmptyRecommendations />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Recommendations');
  });

  it('renders the prompt message', () => {
    render(<EmptyRecommendations />);
    expect(
      screen.getByText(/rate titles to get recommendations/i)
    ).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<EmptyRecommendations />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
