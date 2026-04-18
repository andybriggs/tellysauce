import { render, screen } from '@testing-library/react';
import Container from './Container';

describe('Container', () => {
  it('renders children', () => {
    render(<Container><p>Hello world</p></Container>);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('applies max-width class', () => {
    const { container } = render(<Container><span>Content</span></Container>);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('max-w-6xl');
  });

  it('renders multiple children', () => {
    render(
      <Container>
        <span>First</span>
        <span>Second</span>
      </Container>
    );
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
});
