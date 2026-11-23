import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import site from "../content/site.json";
import { useConverter } from "../hooks/useConverter.js";
import { outputBlob, saveBlob, zipBlob } from "../lib/save.js";
import { baseName, fill, slugify } from "../lib/text.js";
import FileItem from "./FileItem.jsx";
import Blob from "./Blob.jsx";
import { FilePlusIcon, Spinner } from "./Icons.jsx";

const t = site.converter;
const IMAGE_EXTENSIONS = /\.(heic|heif|avif|jfif|webp|svg|ico|bmp)$/i;
const ACCEPT = "image/*,.heic,.heif,.avif,.jfif";

const isImage = (file) =>
  file.type.startsWith("image/") || IMAGE_EXTENSIONS.test(file.name);

const hasFiles = (event) =>
  [...(event.dataTransfer?.types ?? [])].includes("Files");

function outputNames(items, fallbackFormat) {
  const used = new Set();
  const names = new Map();
  for (const item of items) {
    const extension = item.result?.format ?? fallbackFormat;
    const base =
      slugify(item.fileName) ||
      slugify(item.alt) ||
      slugify(baseName(item.file.name)) ||
      "image";
    let name = `${base}.${extension}`;
    for (let n = 2; used.has(name); n++) name = `${base}-${n}.${extension}`;
    used.add(name);
    names.set(item.id, name);
  }
  return names;
}

function Settings({ settings, onChange }) {
  const id = useId();
  const isSvg = settings.format === "svg";
  const slider = isSvg
    ? { key: "colors", label: t.colorsLabel, min: 2, max: 32, step: 1, suffix: "" }
    : { key: "quality", label: t.qualityLabel, min: 10, max: 100, step: 5, suffix: "%" };

  return (
    <div className="grid gap-6 border-t border-white/10 px-6 py-6 sm:grid-cols-2 sm:px-10">
      <fieldset>
        <legend className="text-sm font-medium text-ink-200">
          {t.formatLabel}
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-black/40 p-1">
          {Object.entries(t.formats).map(([value, format]) => (
            <label
              key={value}
              className="relative flex min-h-11 cursor-pointer items-center justify-center rounded-full text-sm font-semibold text-ink-300 transition-colors hover:text-white has-checked:bg-white has-checked:text-black has-focus-visible:outline-3 has-focus-visible:outline-brand-400"
            >
              <input
                type="radio"
                name={`${id}-format`}
                value={value}
                checked={settings.format === value}
                onChange={() => onChange({ ...settings, format: value })}
                aria-describedby={`${id}-format-hint`}
                className="sr-only"
                data-testid={`format-${value}`}
              />
              {format.label}
            </label>
          ))}
        </div>
        <p id={`${id}-format-hint`} className="mt-2 text-xs text-ink-300">
          {t.formats[settings.format].hint}
        </p>
      </fieldset>

      <div>
        <div className="flex items-baseline justify-between">
          <label
            htmlFor={`${id}-slider`}
            className="text-sm font-medium text-ink-200"
          >
            {slider.label}
          </label>
          <output
            htmlFor={`${id}-slider`}
            className="text-sm font-semibold tabular-nums text-white"
          >
            {settings[slider.key]}
            {slider.suffix}
          </output>
        </div>
        <input
          id={`${id}-slider`}
          type="range"
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={settings[slider.key]}
          onChange={(event) =>
            onChange({ ...settings, [slider.key]: Number(event.target.value) })
          }
          className="mt-3 h-11 w-full cursor-pointer"
        />
      </div>
    </div>
  );
}

export default function Converter({ settings, convertSettings, onSettingsChange }) {
  const inputId = useId();
  const { items, addFiles, removeItem, clearAll, setAlt, setFileName } =
    useConverter(convertSettings);
  const [dragging, setDragging] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const addImages = useCallback(
    (files) => addFiles([...files].filter(isImage)),
    [addFiles],
  );

  useEffect(() => {
    let depth = 0;
    const onEnter = (event) => {
      if (!hasFiles(event)) return;
      depth += 1;
      setDragging(true);
    };
    const onLeave = (event) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onOver = (event) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const onDrop = (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      addImages(event.dataTransfer.files);
    };
    const onPaste = (event) => {
      const files = [...(event.clipboardData?.files ?? [])].filter(isImage);
      if (!files.length) return;
      event.preventDefault();
      addFiles(files);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [addFiles, addImages]);

  const names = useMemo(
    () => outputNames(items, convertSettings.format),
    [items, convertSettings.format],
  );
  const ready = items.filter((item) => item.result);
  const activeId = items.find((item) => item.status === "queued")?.id;

  const download = useCallback(
    (item, name) => saveBlob(outputBlob(item.result, item.alt), name),
    [],
  );

  const downloadAll = async () => {
    setZipping(true);
    try {
      const entries = ready.map((item) => ({
        name: names.get(item.id),
        blob: outputBlob(item.result, item.alt),
        compress: item.result.format === "svg",
      }));
      const manifest = ready.map((item) => ({
        file: names.get(item.id),
        alt: item.alt.trim(),
        width: item.result.width,
        height: item.result.height,
      }));
      saveBlob(await zipBlob(entries, manifest), t.zipName);
    } finally {
      setZipping(false);
    }
  };

  return (
    <>
      <section
        id="converter"
        aria-labelledby={`${inputId}-title`}
        className="relative mx-auto max-w-4xl px-4 pt-10 sm:px-6 sm:pt-16"
      >
        <Blob className="left-1/2 top-0 h-[520px] w-[min(640px,120vw)] -translate-x-1/2 motion-safe:animate-float-slow sm:h-[620px]" />
        <div
          className={`glass relative overflow-hidden rounded-[32px] shadow-2xl shadow-black/60 transition-colors ${dragging ? "border-brand-400!" : ""}`}
        >
          <div
            className={`relative m-3 flex flex-col items-center rounded-[24px] border-2 border-dashed px-5 py-12 text-center transition-colors sm:py-16 ${dragging ? "border-brand-400/80 bg-brand-500/10" : "border-transparent"}`}
          >
            <h1
              id={`${inputId}-title`}
              className="font-display text-4xl font-normal tracking-tight sm:text-5xl"
            >
              {dragging ? t.dropActive : t.dropTitle}
            </h1>
            <p className="mt-3 max-w-md text-ink-300">{t.dropText}</p>
            <input
              id={inputId}
              type="file"
              accept={ACCEPT}
              multiple
              className="peer sr-only"
              data-testid="file-input"
              onChange={(event) => {
                addImages(event.target.files);
                event.target.value = "";
              }}
            />
            <label
              htmlFor={inputId}
              className="mt-8 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-brand-600 px-7 font-semibold text-white shadow-[0_0_32px_-6px_rgb(26_140_255/0.7)] transition-colors hover:bg-brand-700 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-400"
            >
              <FilePlusIcon className="size-5" />
              {t.selectButton}
            </label>
          </div>
          <Settings settings={settings} onChange={onSettingsChange} />
        </div>
      </section>

      {items.length > 0 && (
        <section
          aria-labelledby={`${inputId}-list`}
          className="relative mx-auto mt-12 max-w-4xl px-4 sm:px-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id={`${inputId}-list`}
              className="font-display text-3xl font-normal tracking-tight"
            >
              {t.listTitle}{" "}
              <span className="text-base font-normal text-ink-300">
                ({items.length === 1 ? t.countOne : fill(t.count, { n: items.length })})
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadAll}
                disabled={!ready.length || zipping}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="download-all"
              >
                {zipping && <Spinner className="size-4" />}
                {zipping ? t.zipping : t.downloadAll}
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold text-ink-200 transition-colors hover:bg-white/5 hover:text-white"
              >
                {t.clearAll}
              </button>
            </div>
          </div>
          <ul className="mt-5 space-y-4">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <FileItem
                  key={item.id}
                  item={item}
                  active={item.id === activeId}
                  outputName={names.get(item.id)}
                  onAlt={setAlt}
                  onFileName={setFileName}
                  onRemove={removeItem}
                  onDownload={download}
                  onAnnounce={setAnnouncement}
                />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
