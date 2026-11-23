import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import Logo from "./components/Logo.jsx";
import site from "./content/site.json";

const Home = lazy(() => import("./pages/Home.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

export default function App() {
  return (
    <div className="bg-grid relative isolate flex min-h-screen flex-col overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(60%_70%_at_80%_0%,rgb(26_140_255/0.16),transparent_70%),linear-gradient(to_bottom,var(--color-ink-800),transparent)]"
      />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-3 focus:text-white"
      >
        {site.skipLink}
      </a>
      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            to="/"
            aria-label={site.header.homeLabel}
            className="inline-flex min-h-11 items-center gap-2.5 rounded-md"
          >
            <Logo className="size-8 shrink-0" />
            <span className="text-xl font-semibold tracking-tight">
              {site.header.brand}
            </span>
            <span className="hidden rounded-md border border-ink-700 px-2 py-0.5 text-sm text-ink-300 sm:inline">
              {site.header.product}
            </span>
          </Link>
          <p className="hidden items-center gap-2 text-sm text-ink-300 md:flex">
            <svg
              viewBox="0 0 24 24"
              className="size-4 text-brand-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            {site.header.badge}
          </p>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="border-t border-ink-800 bg-ink-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-ink-300 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{site.footer.text}</p>
          <p>{site.footer.note}</p>
        </div>
      </footer>
    </div>
  );
}
