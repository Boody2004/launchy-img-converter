import { m } from "framer-motion";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import site from "../content/site.json";
import { svgDocument } from "../lib/encode.js";
import { fill, formatBytes, imgSnippet } from "../lib/text.js";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, Spinner } from "./Icons.jsx";

const ALT_MAX = 125;
const t = site.item;

function useBlobSource(blob) {
  const ref = useRef(null);
  useEffect(() => {
    if (!blob || !ref.current) return undefined;
    const url = URL.createObjectURL(blob);
    ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return ref;
}

const field =
  "min-h-11 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 text-[15px] text-white placeholder:text-ink-300/70 focus:border-brand-400 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-brand-400/50";

const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function FileItem({
  item,
  active,
  outputName,
  onAlt,
  onFileName,
  onRemove,
  onDownload,
  onAnnounce,
}) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  const { result, status, file, alt } = item;
  const busy = status === "queued";

  const previewBlob = useMemo(() => {
    if (!result) return null;
    if (result.format === "webp") return result.blob;
    return new Blob([svgDocument({ ...result, title: "" })], {
      type: "image/svg+xml",
    });
  }, [result]);
  const previewRef = useBlobSource(previewBlob);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const snippet = result
    ? imgSnippet({
        name: outputName,
        alt: alt.trim(),
        width: result.width,
        height: result.height,
      })
    : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      onAnnounce(fill(t.copiedAnnounce, { name: outputName }));
    } catch {
      setCopied(false);
    }
  };

  const change = result ? Math.round((1 - result.size / file.size) * 100) : 0;
  const extension = outputName.slice(outputName.lastIndexOf("."));
  const autoName = outputName.slice(0, outputName.lastIndexOf("."));

  let statusText = null;
  if (busy) statusText = active ? t.converting : t.queued;

  return (
    <m.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-ink-700 bg-ink-850 p-4 sm:p-5"
      data-testid="file-item"
      data-status={status}
    >
      <div className="grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-5">
        <div className="bg-checker relative flex size-28 items-center justify-center overflow-hidden rounded-lg border border-ink-700">
          {result && (
            <img
              ref={previewRef}
              alt=""
              width="112"
              height="112"
              decoding="async"
              className={`size-full object-contain transition-opacity ${busy ? "opacity-40" : ""}`}
            />
          )}
          {busy && (
            <Spinner className="absolute size-7 text-brand-400" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium" title={file.name}>
                {file.name}
              </p>
              <p className="mt-1 text-sm text-ink-300">
                {formatBytes(file.size)}
                {result && (
                  <>
                    {" → "}
                    <span className="font-medium text-white">
                      {formatBytes(result.size)}
                    </span>
                    {` · ${result.width}×${result.height} · `}
                    <span className={change >= 0 ? "text-emerald-400" : "text-amber-300"}>
                      {change >= 0
                        ? fill(t.saved, { percent: change })
                        : fill(t.bigger, { percent: -change })}
                    </span>
                  </>
                )}
              </p>
              {statusText && (
                <p className="mt-1 text-sm text-brand-300">{statusText}</p>
              )}
              {status === "error" && (
                <p className="mt-1 text-sm text-red-300">
                  {item.error === "decode" ? t.errorDecode : t.errorConvert}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={fill(t.remove, { name: file.name })}
              className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-ink-800 hover:text-white"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>

          {item.error !== "decode" && (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <label
                      htmlFor={`${id}-alt`}
                      className="text-sm font-medium text-ink-200"
                    >
                      {t.altLabel}
                    </label>
                    <span
                      className={`text-xs tabular-nums ${alt.length > ALT_MAX ? "text-amber-300" : "text-ink-300"}`}
                    >
                      {fill(t.altCount, { n: alt.length, max: ALT_MAX })}
                    </span>
                  </div>
                  <input
                    id={`${id}-alt`}
                    type="text"
                    value={alt}
                    onChange={(event) => onAlt(item.id, event.target.value)}
                    placeholder={t.altPlaceholder}
                    aria-describedby={`${id}-alt-hint`}
                    className={`${field} mt-1.5`}
                    data-testid="alt-input"
                  />
                  <p id={`${id}-alt-hint`} className="mt-1.5 text-xs text-ink-300">
                    {fill(t.altHint, { max: ALT_MAX })}
                  </p>
                </div>
                <div>
                  <label
                    htmlFor={`${id}-name`}
                    className="text-sm font-medium text-ink-200"
                  >
                    {t.nameLabel}
                  </label>
                  <div className="mt-1.5 flex">
                    <input
                      id={`${id}-name`}
                      type="text"
                      value={item.fileName}
                      onChange={(event) =>
                        onFileName(item.id, event.target.value)
                      }
                      placeholder={autoName}
                      spellCheck="false"
                      autoCapitalize="none"
                      className={`${field} rounded-r-none`}
                      data-testid="name-input"
                    />
                    <span className="inline-flex min-h-11 items-center rounded-r-lg border border-l-0 border-ink-700 bg-ink-800 px-3 font-mono text-sm text-ink-300">
                      {extension}
                    </span>
                  </div>
                </div>
              </div>

              {result && (
                <pre
                  className="mt-4 whitespace-pre-wrap break-all rounded-lg border border-ink-700 bg-ink-950 px-3 py-2.5 font-mono text-xs leading-relaxed text-brand-300"
                  data-testid="html-snippet"
                >
                  {snippet}
                </pre>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!result}
                  onClick={() => onDownload(item, outputName)}
                  className={`${button} bg-brand-600 text-white hover:bg-brand-700`}
                >
                  <DownloadIcon className="size-4" />
                  {t.download}
                </button>
                <button
                  type="button"
                  disabled={!result}
                  onClick={copy}
                  className={`${button} border border-ink-700 text-ink-200 hover:border-ink-600 hover:bg-ink-800`}
                >
                  {copied ? (
                    <CheckIcon className="size-4 text-emerald-400" />
                  ) : (
                    <CopyIcon className="size-4" />
                  )}
                  {copied ? t.copied : t.copyHtml}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </m.li>
  );
}

export default memo(FileItem);
