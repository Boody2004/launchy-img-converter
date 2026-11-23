import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";
import { useEffect, useState } from "react";
import Converter from "../components/Converter.jsx";
import site from "../content/site.json";

const DEFAULT_SETTINGS = { format: "webp", quality: 80, colors: 16 };

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function Home() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const convertSettings = useDebounced(settings, 300);
  const { formats } = site;

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <Converter
          settings={settings}
          convertSettings={convertSettings}
          onSettingsChange={setSettings}
        />

        <section
          id="formats"
          aria-labelledby="formats-title"
          className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:pb-28"
        >
          <h2
            id="formats-title"
            className="text-xs font-medium uppercase tracking-[0.3em] text-ink-300"
          >
            {formats.title}
          </h2>
          <ul className="mt-5 flex flex-wrap justify-center gap-2">
            {formats.list.map((format) => (
              <li
                key={format}
                className="rounded-full border border-white/10 px-3.5 py-1.5 text-sm text-ink-200"
              >
                {format}
              </li>
            ))}
          </ul>
        </section>
      </MotionConfig>
    </LazyMotion>
  );
}
