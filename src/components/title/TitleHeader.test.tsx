import { render, screen } from '@testing-library/react';
import TitleHeader from './TitleHeader';

describe('TitleHeader', () => {
  it('renders the title text', () => {
    render(<TitleHeader title="Breaking Bad" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Breaking Bad');
  });

  it('renders the action slot when provided', () => {
    render(<TitleHeader title="The Wire" actionSlot={<button>Add to list</button>} />);
    expect(screen.getByRole('button', { name: 'Add to list' })).toBeInTheDocument();
  });

  it('does not render the action slot wrapper when not provided', () => {
    const { container } = render(<TitleHeader title="Sopranos" />);
    // Only one div child inside the wrapper — the h1, no action slot div
    const innerDivs = container.querySelector('div')?.querySelectorAll('div');
    expect(innerDivs).toHaveLength(0);
  });

  it('renders both title and action slot together', () => {
    render(<TitleHeader title="Succession" actionSlot={<span>★★★★★</span>} />);
    expect(screen.getByText('Succession')).toBeInTheDocument();
    expect(screen.getByText('★★★★★')).toBeInTheDocument();
  });
});
