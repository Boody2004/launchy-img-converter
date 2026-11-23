import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import Logo from "./components/Logo.jsx";
import site from "./content/site.json";

const Home = lazy(() => import("./pages/Home.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

export default function App() {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-5 focus:py-3 focus:font-medium focus:text-black"
      >
        {site.skipLink}
      </a>
      <header className="relative z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            to="/"
            aria-label={site.header.homeLabel}
            className="glass inline-flex min-h-11 items-center gap-2 rounded-full py-1.5 pl-2 pr-4"
          >
            <Logo className="size-7 shrink-0" />
            <span className="font-display text-lg font-medium">
              {site.header.brand}
            </span>
          </Link>
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
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-ink-300 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-2">
            <Logo className="size-5" />
            {site.footer.text}
          </p>
          <p>{site.footer.note}</p>
        </div>
      </footer>
    </div>
  );
}
