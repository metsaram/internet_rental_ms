import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';

describe('ConfirmDialog Component', () => {
  it('renders title, description, and action buttons when open', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete invoice"
        description="Delete invoice INV-2024-001? This action cannot be undone."
        confirmText="Delete"
        destructive
        onConfirm={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Delete invoice' })).toBeInTheDocument();
    expect(screen.getByText(/Delete invoice INV-2024-001/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('invokes onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete invoice"
        confirmText="Delete"
        onConfirm={handleConfirm}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: 'Delete' });
    await user.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('safely catches errors thrown by onConfirm without unhandled rejection crash', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rejectingConfirm = vi.fn().mockRejectedValue(new Error('Only draft invoices can be deleted; void instead to preserve history'));

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete invoice"
        confirmText="Delete"
        onConfirm={rejectingConfirm}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: 'Delete' });
    // Should not throw unhandled exception
    await user.click(confirmBtn);

    expect(rejectingConfirm).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('prevents duplicate execution when clicked multiple times while pending', async () => {
    const user = userEvent.setup();
    let resolvePromise: () => void = () => {};
    const slowConfirm = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
    });

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete service"
        confirmText="Delete"
        onConfirm={slowConfirm}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: 'Delete' });
    // First click starts execution
    await user.click(confirmBtn);
    expect(slowConfirm).toHaveBeenCalledTimes(1);

    // Button should now show busy state and be disabled
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn).toHaveTextContent('Working...');

    // Attempt second click while still busy
    await user.click(confirmBtn);
    expect(slowConfirm).toHaveBeenCalledTimes(1);

    // Resolve the async execution
    await act(async () => {
      resolvePromise();
    });
  });
});
