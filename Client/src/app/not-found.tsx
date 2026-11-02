import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="empty" style={{ minHeight: '80vh' }}>
      <span className="eyebrow">404 · OFF THE BEATEN PATH</span>
      <h1>This page isn’t here.</h1>
      <p className="muted">Let’s get you back into flow.</p>
      <Link href="/app" className="button primary">
        Back to workspace
      </Link>
    </main>
  );
}
