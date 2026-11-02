'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X, LoaderCircle, AlertCircle, PackageOpen } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

export function Button({
  children,
  className = '',
  busy,
  variant = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
}) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={`button ${variant} ${className}`}
    >
      {busy && <LoaderCircle size={17} className="spin" />}
      {children}
    </button>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={`modal ${wide ? 'wide' : ''}`}>
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description className={description ? 'muted' : 'sr-only'}>
                {description ?? 'Complete the form below.'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" aria-label="Close dialog">
                <X size={20} />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Badge({ status = 'DRAFT' }: { status?: string }) {
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      <span />
      {status.replaceAll('_', ' ').toLowerCase()}
    </span>
  );
}
export function Empty({
  title = 'Nothing here yet',
  description = 'Create your first record to get started.',
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <PackageOpen size={28} />
      </span>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="empty" role="alert">
      <AlertCircle size={28} />
      <h3>We couldn’t load this</h3>
      <p className="muted">{message}</p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeletons" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  );
}
