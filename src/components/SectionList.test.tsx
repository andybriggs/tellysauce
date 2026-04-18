import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import SectionList from './SectionList';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const items = [
  { id: 1, name: 'Breaking Bad' },
  { id: 2, name: 'The Wire' },
];

describe('SectionList', () => {
  it('renders the section title', () => {
    render(
      <SectionList
        title="My Shows"
        items={items}
        emptyState={<p>Empty</p>}
        renderItem={(item) => <span>{item.name}</span>}
        getKey={(item) => item.id}
      />
    );
    expect(screen.getByText('My Shows')).toBeInTheDocument();
  });

  it('renders each item', () => {
    render(
      <SectionList
        title="Shows"
        items={items}
        emptyState={<p>Empty</p>}
        renderItem={(item) => <span>{item.name}</span>}
        getKey={(item) => item.id}
      />
    );
    expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
    expect(screen.getByText('The Wire')).toBeInTheDocument();
  });

  it('renders empty state when items array is empty', () => {
    render(
      <SectionList
        title="My Shows"
        items={[]}
        emptyState={<p>No shows yet</p>}
        renderItem={(item: { id: number; name: string }) => <span>{item.name}</span>}
        getKey={(item: { id: number; name: string }) => item.id}
      />
    );
    expect(screen.getByText('No shows yet')).toBeInTheDocument();
  });

  it('renders items as a flex list in carousel layout (default)', () => {
    const { container } = render(
      <SectionList
        title="Shows"
        items={items}
        emptyState={<p>Empty</p>}
        renderItem={(item) => <span>{item.name}</span>}
        getKey={(item) => item.id}
      />
    );
    const list = container.querySelector('ul');
    expect(list?.className).toContain('flex');
  });

  it('renders items as a grid in grid layout', () => {
    const { container } = render(
      <SectionList
        title="Shows"
        items={items}
        layout="grid"
        emptyState={<p>Empty</p>}
        renderItem={(item) => <span>{item.name}</span>}
        getKey={(item) => item.id}
      />
    );
    const list = container.querySelector('ul');
    expect(list?.className).toContain('grid');
  });

  it('renders a view-all link in carousel layout when viewAllHref provided', () => {
    render(
      <SectionList
        title="Shows"
        items={items}
        viewAllHref="/shows"
        emptyState={<p>Empty</p>}
        renderItem={(item) => <span>{item.name}</span>}
        getKey={(item) => item.id}
      />
    );
    expect(screen.getByText('(View All)')).toBeInTheDocument();
  });

  it('does not render a view-all link in grid layout', () => {
    render(
      <SectionList
        title="Shows"
        items={items}
        layout="grid"
        viewAllHref="/shows"
        emptyState={<p>Empty</p>}
        renderItem={(item) => <span>{item.name}</span>}
        getKey={(item) => item.id}
      />
    );
    expect(screen.queryByText('(View All)')).toBeNull();
  });
});
