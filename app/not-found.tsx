import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4 text-ink dark:text-paper">
      <section className="w-full max-w-md rounded-lg border border-line bg-white/78 p-5 text-center shadow-soft dark:border-white/10 dark:bg-white/10">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-ink/65 dark:text-paper/65">This page does not exist.</p>
        <Link
          className="mt-5 inline-flex rounded-full bg-ink px-4 py-2 font-medium text-paper dark:bg-paper dark:text-ink"
          href="/"
        >
          Back to gallery
        </Link>
      </section>
    </main>
  );
}
