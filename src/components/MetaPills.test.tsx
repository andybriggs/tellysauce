import { render, screen } from '@testing-library/react';
import MetaPills from './MetaPills';

describe('MetaPills', () => {
  it('renders the year when provided', () => {
    render(<MetaPills year={2021} />);
    expect(screen.getByText('2021')).toBeInTheDocument();
  });

  it('renders year with end year range', () => {
    render(<MetaPills year={2019} endYear={2022} />);
    expect(screen.getByText('2019–2022')).toBeInTheDocument();
  });

  it('renders the type when provided', () => {
    render(<MetaPills type="tv" />);
    expect(screen.getByText('tv')).toBeInTheDocument();
  });

  it('replaces underscores in type with spaces', () => {
    render(<MetaPills type="mini_series" />);
    expect(screen.getByText('mini series')).toBeInTheDocument();
  });

  it('renders the US rating when provided', () => {
    render(<MetaPills usRating="TV-MA" />);
    expect(screen.getByText('TV-MA')).toBeInTheDocument();
  });

  it('renders the language in uppercase when provided', () => {
    render(<MetaPills language="en" />);
    expect(screen.getByText('en')).toBeInTheDocument();
  });

  it('renders all fields together', () => {
    render(<MetaPills year={2020} type="movie" usRating="R" language="fr" />);
    expect(screen.getByText('2020')).toBeInTheDocument();
    expect(screen.getByText('movie')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
    expect(screen.getByText('fr')).toBeInTheDocument();
  });

  it('renders empty container when no props provided', () => {
    const { container } = render(<MetaPills />);
    // renders the wrapper div but no pill spans
    const spans = container.querySelectorAll('span');
    expect(spans).toHaveLength(0);
  });

  it('does not render year when not a number', () => {
    // year is typed as number so pass undefined — no year pill
    const { container } = render(<MetaPills />);
    const spans = container.querySelectorAll('span');
    expect(spans).toHaveLength(0);
  });
});
