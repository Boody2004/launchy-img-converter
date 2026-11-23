import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import site from "./content/site.json";

const Home = lazy(() => import("./pages/Home.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-3 focus:text-white"
      >
        {site.skipLink}
      </a>
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-2">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center font-semibold"
          >
            {site.header.brand}
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-16">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="border-t border-slate-200">
        <p className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-600">
          {site.footer.text}
        </p>
      </footer>
    </div>
  );
}
