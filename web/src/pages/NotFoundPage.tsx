import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="font-mono text-xs tracking-widest text-ink-faint uppercase">404</p>
      <h1 className="mt-2 text-lg font-semibold">No such page</h1>
      <Link to="/" className="mt-4 inline-block text-sm text-accent hover:underline">
        Back to the overview
      </Link>
    </div>
  );
}
