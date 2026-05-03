import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { PillTabs } from './PillTabs';

const options = [
  { value: 'recent', label: 'Recent' },
  { value: 'all', label: 'All Time' },
  { value: 'popular', label: 'Popular' },
] as const;

describe('PillTabs', () => {
  it('renders all tab options', () => {
    const onChange = vi.fn();
    render(<PillTabs value="recent" options={[...options]} onChange={onChange} />);
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('All Time')).toBeInTheDocument();
    expect(screen.getByText('Popular')).toBeInTheDocument();
  });

  it('marks the active tab with aria-selected="true"', () => {
    const onChange = vi.fn();
    render(<PillTabs value="all" options={[...options]} onChange={onChange} />);
    const tabs = screen.getAllByRole('tab');
    const allTimeTab = tabs.find((t) => t.textContent === 'All Time');
    expect(allTimeTab).toHaveAttribute('aria-selected', 'true');
  });

  it('marks inactive tabs with aria-selected="false"', () => {
    const onChange = vi.fn();
    render(<PillTabs value="recent" options={[...options]} onChange={onChange} />);
    const tabs = screen.getAllByRole('tab');
    const allTimeTab = tabs.find((t) => t.textContent === 'All Time');
    expect(allTimeTab).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange with the correct value when a tab is clicked', () => {
    const onChange = vi.fn();
    render(<PillTabs value="recent" options={[...options]} onChange={onChange} />);
    fireEvent.click(screen.getByText('All Time'));
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('does not call onChange when a disabled tab is clicked', () => {
    const onChange = vi.fn();
    const withDisabled = [
      { value: 'recent', label: 'Recent' },
      { value: 'all', label: 'All Time', disabled: true },
    ] as const;
    render(<PillTabs value="recent" options={[...withDisabled]} onChange={onChange} />);
    fireEvent.click(screen.getByText('All Time'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders the tablist with role="tablist"', () => {
    const onChange = vi.fn();
    render(<PillTabs value="recent" options={[...options]} onChange={onChange} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });
});
