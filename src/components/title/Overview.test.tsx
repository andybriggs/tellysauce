import { render, screen } from '@testing-library/react';
import Overview from './Overview';

describe('Overview', () => {
  it('renders text when provided', () => {
    render(<Overview text="A gripping drama about family." />);
    expect(screen.getByText('A gripping drama about family.')).toBeInTheDocument();
  });

  it('renders nothing when text is null', () => {
    const { container } = render(<Overview text={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when text is undefined', () => {
    const { container } = render(<Overview />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when text is empty string', () => {
    const { container } = render(<Overview text="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders long text without truncation (no show more in this component)', () => {
    const longText = 'A '.repeat(200) + 'story.';
    render(<Overview text={longText} />);
    expect(screen.getByText(longText)).toBeInTheDocument();
  });
});
