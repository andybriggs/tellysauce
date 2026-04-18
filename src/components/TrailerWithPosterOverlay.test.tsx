import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import TrailerWithPosterOverlay from './TrailerWithPosterOverlay';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

describe('TrailerWithPosterOverlay', () => {
  it('renders the YouTube iframe with enablejsapi=1', () => {
    render(
      <TrailerWithPosterOverlay trailerKey="abc123" title="Breaking Bad" />
    );
    const iframe = screen.getByTitle('Trailer');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      'src',
      'https://www.youtube.com/embed/abc123?enablejsapi=1'
    );
  });

  it('renders the poster image when poster prop is provided', () => {
    render(
      <TrailerWithPosterOverlay
        trailerKey="abc123"
        poster="https://example.com/poster.jpg"
        title="Breaking Bad"
      />
    );
    expect(screen.getByAltText('Breaking Bad poster')).toBeInTheDocument();
  });

  it('does not render a poster image when poster prop is absent', () => {
    render(
      <TrailerWithPosterOverlay trailerKey="abc123" title="Breaking Bad" />
    );
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('poster is visible by default (before any play event)', () => {
    render(
      <TrailerWithPosterOverlay
        trailerKey="abc123"
        poster="https://example.com/poster.jpg"
        title="Breaking Bad"
      />
    );
    const posterWrapper = screen.getByAltText('Breaking Bad poster').closest('div');
    expect(posterWrapper).not.toHaveClass('opacity-0');
    expect(posterWrapper).toHaveClass('opacity-100');
  });

  it('hides the poster when YouTube fires a playing (state=1) postMessage', () => {
    render(
      <TrailerWithPosterOverlay
        trailerKey="abc123"
        poster="https://example.com/poster.jpg"
        title="Breaking Bad"
      />
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 1 }),
        })
      );
    });

    const posterWrapper = screen.getByAltText('Breaking Bad poster').closest('div');
    expect(posterWrapper).toHaveClass('opacity-0');
    expect(posterWrapper).toHaveClass('pointer-events-none');
  });

  it('hides the poster when YouTube fires a buffering (state=3) postMessage', () => {
    render(
      <TrailerWithPosterOverlay
        trailerKey="abc123"
        poster="https://example.com/poster.jpg"
        title="Breaking Bad"
      />
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 3 }),
        })
      );
    });

    const posterWrapper = screen.getByAltText('Breaking Bad poster').closest('div');
    expect(posterWrapper).toHaveClass('opacity-0');
  });

  it('restores the poster when YouTube fires a paused (state=2) postMessage after playing', () => {
    render(
      <TrailerWithPosterOverlay
        trailerKey="abc123"
        poster="https://example.com/poster.jpg"
        title="Breaking Bad"
      />
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 1 }),
        })
      );
    });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 2 }),
        })
      );
    });

    const posterWrapper = screen.getByAltText('Breaking Bad poster').closest('div');
    expect(posterWrapper).toHaveClass('opacity-100');
    expect(posterWrapper).not.toHaveClass('opacity-0');
  });

  it('restores the poster when YouTube fires an ended (state=0) postMessage', () => {
    render(
      <TrailerWithPosterOverlay
        trailerKey="abc123"
        poster="https://example.com/poster.jpg"
        title="Breaking Bad"
      />
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 1 }),
        })
      );
    });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
        })
      );
    });

    const posterWrapper = screen.getByAltText('Breaking Bad poster').closest('div');
    expect(posterWrapper).toHaveClass('opacity-100');
  });

  it('ignores non-JSON postMessages without throwing', () => {
    render(
      <TrailerWithPosterOverlay
        trailerKey="abc123"
        poster="https://example.com/poster.jpg"
        title="Breaking Bad"
      />
    );

    expect(() => {
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', { data: 'not-json' })
        );
      });
    }).not.toThrow();
  });

  it('ignores postMessages with unrelated event names', () => {
    render(
      <TrailerWithPosterOverlay
        trailerKey="abc123"
        poster="https://example.com/poster.jpg"
        title="Breaking Bad"
      />
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onReady' }),
        })
      );
    });

    const posterWrapper = screen.getByAltText('Breaking Bad poster').closest('div');
    expect(posterWrapper).toHaveClass('opacity-100');
  });
});
