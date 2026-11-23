import { AnimatePresence, m } from "framer-motion";
import site from "../content/site.json";
import { ArrowsIcon, FileIcon } from "./Icons.jsx";

const card =
  "relative flex h-36 w-32 flex-col items-center justify-center gap-3 rounded-2xl border bg-ink-850/90 shadow-xl shadow-black/40";

export default function FormatVisual({ format }) {
  const target = site.converter.formats[format].label;

  return (
    <div
      aria-hidden="true"
      className="relative hidden h-80 w-[440px] items-center justify-center lg:flex"
    >
      <div className="absolute size-[380px] rounded-full border border-ink-700/60" />
      <div className="absolute size-[260px] rounded-full border border-ink-700/60" />

      <div className="relative flex items-center">
        <div className={`${card} border-ink-700`}>
          <FileIcon className="size-10 text-ink-200" />
          <span className="text-sm font-semibold uppercase tracking-wider">
            {site.home.visual.from}
          </span>
        </div>

        <div className="flex w-36 flex-col items-center gap-2">
          <div className="flex w-full items-center">
            <span className="h-px flex-1 bg-ink-600" />
            <m.span
              key={format}
              initial={{ rotate: -180 }}
              animate={{ rotate: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex size-11 items-center justify-center rounded-full border border-brand-500/40 bg-brand-500/10 text-brand-400"
            >
              <ArrowsIcon className="size-5" />
            </m.span>
            <span className="h-px flex-1 bg-ink-600" />
          </div>
          <span className="text-xs uppercase tracking-[0.3em] text-ink-300">
            {site.home.visual.to}
          </span>
        </div>

        <div
          className={`${card} border-brand-500/50 shadow-[0_0_48px_-8px_rgb(26_140_255/0.55)]`}
        >
          <FileIcon className="size-10 text-brand-400" />
          <span className="relative h-5 overflow-hidden text-sm font-semibold uppercase tracking-wider">
            <AnimatePresence mode="popLayout" initial={false}>
              <m.span
                key={target}
                className="block"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {target}
              </m.span>
            </AnimatePresence>
          </span>
        </div>
      </div>
    </div>
  );
}
