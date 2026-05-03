import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import AuthButton from './AuthButton';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string | null; alt: string }) =>
    src ? <img src={src} alt={alt} /> : <span aria-label={alt} />,
}));

const mockSignIn = vi.fn();
const mockSignOut = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
  signIn: vi.fn((...args: unknown[]) => mockSignIn(...args)),
  signOut: vi.fn((...args: unknown[]) => mockSignOut(...args)),
}));

describe('AuthButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sign in button when unauthenticated', () => {
    render(<AuthButton />);
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });

  it('calls signIn with google when sign in button is clicked', async () => {
    const { signIn } = await import('next-auth/react');
    render(<AuthButton />);
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(signIn).toHaveBeenCalledWith('google', expect.objectContaining({ callbackUrl: expect.any(String) }));
  });

  it('shows loading skeleton when status is loading', async () => {
    const { useSession } = await import('next-auth/react');
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({ data: null, status: 'loading' });
    const { container } = render(<AuthButton />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders user name when authenticated', async () => {
    const { useSession } = await import('next-auth/react');
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { user: { name: 'Alice Smith', image: '/avatar.jpg', email: 'alice@example.com' } },
      status: 'authenticated',
    });
    render(<AuthButton />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('renders user avatar image when authenticated', async () => {
    const { useSession } = await import('next-auth/react');
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { user: { name: 'Alice Smith', image: '/avatar.jpg', email: 'alice@example.com' } },
      status: 'authenticated',
    });
    render(<AuthButton />);
    expect(screen.getByRole('img', { name: 'Alice Smith' })).toHaveAttribute('src', '/avatar.jpg');
  });

  it('renders sign out button when authenticated', async () => {
    const { useSession } = await import('next-auth/react');
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { user: { name: 'Alice Smith', image: '/avatar.jpg', email: 'alice@example.com' } },
      status: 'authenticated',
    });
    render(<AuthButton />);
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('calls signOut when sign out button is clicked', async () => {
    const { useSession, signOut } = await import('next-auth/react');
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { user: { name: 'Alice Smith', image: '/avatar.jpg', email: 'alice@example.com' } },
      status: 'authenticated',
    });
    render(<AuthButton />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' });
  });

  it('falls back to email when name is not set', async () => {
    const { useSession } = await import('next-auth/react');
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { user: { name: null, image: null, email: 'alice@example.com' } },
      status: 'authenticated',
    });
    render(<AuthButton />);
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });
});
