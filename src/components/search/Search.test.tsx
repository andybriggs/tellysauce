import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Search from './Search';

const defaultProps = {
  handleSearchInputChange: vi.fn(),
  searchQuery: '',
  isLoading: false,
  showClearResults: false,
  handleSubmit: vi.fn(),
  handleClearSearch: vi.fn(),
};

describe('Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the search input', () => {
    render(<Search {...defaultProps} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('displays the current search query value', () => {
    render(<Search {...defaultProps} searchQuery="Twin Peaks" />);
    expect(screen.getByRole('textbox')).toHaveValue('Twin Peaks');
  });

  it('calls handleSearchInputChange when typing', () => {
    const handleSearchInputChange = vi.fn();
    render(<Search {...defaultProps} handleSearchInputChange={handleSearchInputChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Breaking' } });
    expect(handleSearchInputChange).toHaveBeenCalledTimes(1);
  });

  it('shows "Search" button text by default', () => {
    render(<Search {...defaultProps} />);
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  it('shows "Clear" button text when showClearResults is true', () => {
    render(<Search {...defaultProps} showClearResults={true} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('calls handleSubmit with the search query when Search button is clicked', () => {
    const handleSubmit = vi.fn();
    render(<Search {...defaultProps} searchQuery="Breaking Bad" handleSubmit={handleSubmit} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleSubmit).toHaveBeenCalledWith('Breaking Bad');
  });

  it('calls handleClearSearch when Clear button is clicked', () => {
    const handleClearSearch = vi.fn();
    render(<Search {...defaultProps} showClearResults={true} handleClearSearch={handleClearSearch} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClearSearch).toHaveBeenCalledTimes(1);
  });

  it('shows loading spinner when isLoading is true', () => {
    render(<Search {...defaultProps} isLoading={true} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('disables the submit button when isLoading is true', () => {
    render(<Search {...defaultProps} isLoading={true} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not show loading spinner when isLoading is false', () => {
    render(<Search {...defaultProps} isLoading={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('has placeholder text', () => {
    render(<Search {...defaultProps} />);
    expect(screen.getByPlaceholderText('Twin Peaks')).toBeInTheDocument();
  });
});
