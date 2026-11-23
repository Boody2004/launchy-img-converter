import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import site from "../content/site.json";
import { useConverter } from "../hooks/useConverter.js";
import { outputBlob, saveBlob, zipBlob } from "../lib/save.js";
import { baseName, fill, slugify } from "../lib/text.js";
import FileItem from "./FileItem.jsx";
import { FilePlusIcon, Spinner, UploadCloudIcon } from "./Icons.jsx";

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
    <div className="grid gap-6 border-t border-ink-700 px-5 py-5 sm:grid-cols-2 sm:px-8">
      <fieldset>
        <legend className="text-sm font-medium text-ink-200">
          {t.formatLabel}
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1">
          {Object.entries(t.formats).map(([value, format]) => (
            <label
              key={value}
              className="relative flex min-h-11 cursor-pointer items-center justify-center rounded-md text-sm font-semibold text-ink-300 transition-colors has-checked:bg-brand-600 has-checked:text-white has-focus-visible:outline-3 has-focus-visible:outline-brand-400"
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
        aria-label={t.dropTitle}
        className="mx-auto mt-10 max-w-4xl px-4 sm:mt-12 sm:px-6"
      >
        <div
          className={`overflow-hidden rounded-2xl border bg-ink-850/95 shadow-2xl shadow-black/50 backdrop-blur transition-colors ${dragging ? "border-brand-400" : "border-ink-700"}`}
        >
          <div
            className={`relative m-3 flex flex-col items-center rounded-xl border-2 border-dashed px-5 py-10 text-center transition-colors sm:py-12 ${dragging ? "border-brand-400 bg-brand-500/10" : "border-transparent"}`}
          >
            <UploadCloudIcon className="size-14 text-brand-500" />
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              {dragging ? t.dropActive : t.dropTitle}
            </h2>
            <p className="mt-1.5 text-ink-300">{t.dropText}</p>
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
              className="mt-6 inline-flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg bg-brand-600 px-6 text-lg font-semibold text-white shadow-lg shadow-brand-600/25 transition-colors hover:bg-brand-700 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-400"
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
          className="mx-auto mt-10 max-w-4xl px-4 sm:px-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`${inputId}-list`} className="text-xl font-semibold">
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
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="download-all"
              >
                {zipping && <Spinner className="size-4" />}
                {zipping ? t.zipping : t.downloadAll}
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex min-h-11 items-center rounded-lg border border-ink-700 px-4 text-sm font-semibold text-ink-200 transition-colors hover:border-ink-600 hover:bg-ink-800"
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
