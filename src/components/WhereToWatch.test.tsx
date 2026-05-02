import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import WhereToWatch from './WhereToWatch';
import type { TitleSource } from '@/types/title';

vi.mock('@/components/ResultsTable', () => ({
  default: ({ data }: { data: { name: string }[] }) => (
    <ul>{data.map((s) => <li key={s.name}>{s.name}</li>)}</ul>
  ),
}));

const makeSource = (
  name: string,
  region: string,
  type: TitleSource['type'] = 'sub'
): TitleSource => ({
  source_id: Math.random(),
  name,
  type,
  region,
  icon: '/icon.png',
  ios_url: null,
  android_url: null,
  web_url: null,
  format: null,
  price: null,
});

const allSources = {
  GB: [makeSource('Netflix UK', 'GB'), makeSource('BBC iPlayer', 'GB', 'free')],
  US: [makeSource('Hulu', 'US'), makeSource('Peacock', 'US', 'ads')],
  CA: [makeSource('Crave', 'CA')],
};

describe('WhereToWatch', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'language', {
      value: 'en-GB',
      configurable: true,
    });
  });

  it('renders the "Where to watch" heading', () => {
    render(<WhereToWatch allSources={allSources} />);
    expect(screen.getByText('Where to watch')).toBeInTheDocument();
  });

  it('shows a dropdown with available countries', () => {
    render(<WhereToWatch allSources={allSources} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'United Kingdom' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'United States' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Canada' })).toBeInTheDocument();
  });

  it('defaults to GB and shows GB providers', async () => {
    render(<WhereToWatch allSources={allSources} />);
    await act(async () => {});
    expect(screen.getByText('Netflix UK')).toBeInTheDocument();
    expect(screen.getByText('BBC iPlayer')).toBeInTheDocument();
  });

  it('switches providers when a different region is selected', async () => {
    render(<WhereToWatch allSources={allSources} />);
    await act(async () => {});
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'US' } });
    expect(screen.getByText('Hulu')).toBeInTheDocument();
    expect(screen.getByText('Peacock')).toBeInTheDocument();
    expect(screen.queryByText('Netflix UK')).not.toBeInTheDocument();
  });

  it('persists selected region to localStorage', async () => {
    render(<WhereToWatch allSources={allSources} />);
    await act(async () => {});
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'US' } });
    expect(localStorage.getItem('watch_region')).toBe('US');
  });

  it('restores region from localStorage on mount', async () => {
    localStorage.setItem('watch_region', 'CA');
    render(<WhereToWatch allSources={allSources} />);
    await act(async () => {});
    expect(screen.getByText('Crave')).toBeInTheDocument();
    expect(screen.queryByText('Netflix UK')).not.toBeInTheDocument();
  });

  it('uses navigator.language to detect default region when localStorage is empty', async () => {
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      configurable: true,
    });
    render(<WhereToWatch allSources={allSources} />);
    await act(async () => {});
    expect(screen.getByText('Hulu')).toBeInTheDocument();
  });

  it('shows the dropdown and "No sources found" when stored region has no providers for this title', async () => {
    localStorage.setItem('watch_region', 'JP');
    render(<WhereToWatch allSources={{ GB: [makeSource('Netflix UK', 'GB')] }} />);
    await act(async () => {});
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Japan' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'United Kingdom' })).toBeInTheDocument();
    expect(screen.getByText(/no sources found/i)).toBeInTheDocument();
  });

  it('shows the dropdown and "No sources found" when allSources is empty', async () => {
    render(<WhereToWatch allSources={{}} />);
    await act(async () => {});
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText(/no sources found/i)).toBeInTheDocument();
  });

  it('sorts free and ads sources before sub, rent, and buy', async () => {
    const sources = {
      GB: [
        makeSource('Prime Video', 'GB', 'buy'),
        makeSource('Netflix UK', 'GB', 'sub'),
        makeSource('BBC iPlayer', 'GB', 'free'),
        makeSource('ITVX', 'GB', 'ads'),
        makeSource('Curzon', 'GB', 'rent'),
      ],
    };
    render(<WhereToWatch allSources={sources} />);
    await act(async () => {});
    const items = screen.getAllByRole('listitem');
    const names = items.map((el) => el.textContent);
    expect(names).toEqual(['BBC iPlayer', 'ITVX', 'Netflix UK', 'Curzon', 'Prime Video']);
  });

  it('sorts priority regions (GB, US, CA, AU) before others', () => {
    const sources = {
      DE: [makeSource('Joyn', 'DE')],
      US: [makeSource('Hulu', 'US')],
      GB: [makeSource('Netflix UK', 'GB')],
      AU: [makeSource('Stan', 'AU')],
    };
    render(<WhereToWatch allSources={sources} />);
    const options = screen.getAllByRole('option');
    const values = options.map((o) => o.getAttribute('value'));
    expect(values.indexOf('GB')).toBeLessThan(values.indexOf('US'));
    expect(values.indexOf('US')).toBeLessThan(values.indexOf('AU'));
    expect(values.indexOf('AU')).toBeLessThan(values.indexOf('DE'));
  });
});
