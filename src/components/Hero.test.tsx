import { render, screen } from '@testing-library/react';
import Hero from './Hero';

describe('Hero', () => {
  it('renders the logo image', () => {
    render(<Hero />);
    expect(screen.getByAltText('Telly Sauce logo')).toBeInTheDocument();
  });

  it('renders the brand name heading', () => {
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Telly Sauce');
  });

  it('renders the tagline text', () => {
    render(<Hero />);
    expect(
      screen.getByText(/get started by searching for your favorite titles/i)
    ).toBeInTheDocument();
  });
});
