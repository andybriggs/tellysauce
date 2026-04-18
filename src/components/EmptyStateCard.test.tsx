import { render, screen } from '@testing-library/react';
import EmptyStateCard from './EmptyStateCard';

describe('EmptyStateCard', () => {
  it('renders message text from children', () => {
    render(<EmptyStateCard>Nothing to see here</EmptyStateCard>);
    expect(screen.getByText('Nothing to see here')).toBeInTheDocument();
  });

  it('renders custom children content', () => {
    render(
      <EmptyStateCard>
        <p>Add some titles to get started</p>
      </EmptyStateCard>
    );
    expect(screen.getByText('Add some titles to get started')).toBeInTheDocument();
  });

  it('renders the outer container', () => {
    const { container } = render(<EmptyStateCard>Content</EmptyStateCard>);
    expect(container.firstChild).toBeInTheDocument();
  });
});
