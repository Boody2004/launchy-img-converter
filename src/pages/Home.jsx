import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";
import { useEffect, useState } from "react";
import Converter from "../components/Converter.jsx";
import FormatVisual from "../components/FormatVisual.jsx";
import { LayersIcon } from "../components/Icons.jsx";
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

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-14">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
                {site.home.title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-200">
                {site.home.intro}
              </p>
            </div>
            <FormatVisual format={settings.format} />
          </div>
        </section>

        <Converter
          settings={settings}
          convertSettings={convertSettings}
          onSettingsChange={setSettings}
        />

        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-ink-300">
            <LayersIcon className="size-4 text-brand-400" />
            {site.formats.eyebrow}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            {site.formats.title}
          </h2>
          <p className="mt-2 text-ink-300">{site.formats.text}</p>
          <ul className="mt-6 flex flex-wrap gap-2 rounded-xl border border-dashed border-ink-700 p-4">
            {site.formats.list.map((format) => (
              <li
                key={format}
                className="rounded-md bg-ink-800 px-3 py-1.5 font-mono text-sm text-ink-200"
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
