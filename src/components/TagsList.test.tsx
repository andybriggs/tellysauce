import { render, screen } from '@testing-library/react';
import TagsList from './TagsList';

describe('TagsList', () => {
  it('renders genre tags', () => {
    render(<TagsList genres={['Drama', 'Thriller']} />);
    expect(screen.getByText('Drama')).toBeInTheDocument();
    expect(screen.getByText('Thriller')).toBeInTheDocument();
  });

  it('renders network tags', () => {
    render(<TagsList networks={['Netflix', 'HBO']} />);
    expect(screen.getByText('Netflix')).toBeInTheDocument();
    expect(screen.getByText('HBO')).toBeInTheDocument();
  });

  it('renders both genre and network tags together', () => {
    render(<TagsList genres={['Comedy']} networks={['BBC']} />);
    expect(screen.getByText('Comedy')).toBeInTheDocument();
    expect(screen.getByText('BBC')).toBeInTheDocument();
  });

  it('renders the Tags label when there is content', () => {
    render(<TagsList genres={['Action']} />);
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('renders nothing when both arrays are empty', () => {
    const { container } = render(<TagsList genres={[]} networks={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no props provided', () => {
    const { container } = render(<TagsList />);
    expect(container.firstChild).toBeNull();
  });
});
