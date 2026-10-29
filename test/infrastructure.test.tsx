import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

// Simple component to test React + Next router + DOM testing
function DemoComponent() {
  const router = useRouter();
  return (
    <div>
      <h1 className={cn('title-class', 'active')}>Vitest Infrastructure</h1>
      <button onClick={() => router.push('/dashboard')}>Navigate</button>
    </div>
  );
}

describe('Vitest Testing Infrastructure', () => {
  it('resolves TypeScript path aliases properly', () => {
    const className = cn('foo', 'bar');
    expect(className).toBe('foo bar');
  });

  it('renders React components into JSDOM and supports jest-dom matchers', () => {
    render(<DemoComponent />);
    const heading = screen.getByRole('heading', { name: /vitest infrastructure/i });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass('title-class', 'active');
  });

  it('handles user events and Next.js App Router navigation mock', async () => {
    const user = userEvent.setup();
    render(<DemoComponent />);

    const button = screen.getByRole('button', { name: /navigate/i });
    expect(button).toBeInTheDocument();

    await user.click(button);
    // Verified router mock works without errors
  });
});
