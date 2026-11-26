import { useCallback, useEffect, useRef, useState } from "react";
import { decodeImage } from "../lib/decode.js";
import { toWebp, traceSvg } from "../lib/encode.js";
import { buildVector } from "../lib/pdf-vector.js";

let nextId = 1;
const REMOVED = "removed";

const requeue = (item) =>
  item.error === "decode"
    ? item
    : { ...item, status: "queued", job: item.job + 1 };

async function convert(image, vector, settings, signal) {
  if (settings.format === "svg") {
    const svg = vector
      ? { ...buildVector(vector, settings), source: "vector" }
      : { ...(await traceSvg(image, settings, signal)), source: "trace" };
    return { format: "svg", ...svg, size: new Blob([svg.body]).size };
  }
  const encoded = await toWebp(image, settings);
  return { format: "webp", ...encoded, size: encoded.blob.size };
}

export function useConverter(settings) {
  const [items, setItems] = useState([]);
  const [tick, setTick] = useState(0);
  const decoded = useRef(new Map());
  const running = useRef(null);
  const settingsKey = [
    settings.format,
    settings.quality,
    settings.colors,
    settings.transparent,
    settings.enclosed,
  ].join("-");
  const [appliedKey, setAppliedKey] = useState(settingsKey);

  if (appliedKey !== settingsKey) {
    setAppliedKey(settingsKey);
    setItems((list) => list.map(requeue));
  }

  const update = (id, change) =>
    setItems((list) =>
      list.map((item) => (item.id === id ? change(item) : item)),
    );

  const addFiles = useCallback((files, { fromPdf = false, vector = null } = {}) => {
    const added = [...files].map((file) => ({
      id: nextId++,
      file,
      fromPdf,
      vector,
      status: "queued",
      job: 0,
      alt: "",
      fileName: "",
      result: null,
      error: null,
    }));
    if (added.length) setItems((list) => [...list, ...added]);
  }, []);

  const removeItem = useCallback((id) => {
    decoded.current.get(id)?.close();
    decoded.current.delete(id);
    setItems((list) => list.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    decoded.current.forEach((entry) => entry.close());
    decoded.current.clear();
    setItems([]);
  }, []);

  const setAlt = useCallback(
    (id, alt) => update(id, (item) => ({ ...item, alt })),
    [],
  );

  const setFileName = useCallback(
    (id, fileName) => update(id, (item) => ({ ...item, fileName })),
    [],
  );

  useEffect(() => {
    if (running.current) {
      const { id, job, controller } = running.current;
      const current = items.find((item) => item.id === id);
      if (!current) controller.abort(REMOVED);
      else if (current.job !== job) controller.abort();
      return;
    }

    const next = items.find((item) => item.status === "queued");
    if (!next) return;

    const { id, job, file, fromPdf, vector } = next;
    const controller = new AbortController();
    const { signal } = controller;
    running.current = { id, job, controller };
    const isCurrent = (item) => item.job === job;

    (async () => {
      let image = decoded.current.get(id);
      if (!image) {
        try {
          image = await decodeImage(file);
        } catch {
          update(id, (item) => ({ ...item, status: "error", error: "decode" }));
          return;
        }
        if (signal.reason === REMOVED) {
          image.close();
          return;
        }
        // PDF pages are not cached: a long file would hold too much memory.
        if (!fromPdf) decoded.current.set(id, image);
      }

      try {
        if (signal.aborted) return;
        const result = await convert(image, vector, settings, signal);
        update(id, (item) =>
          isCurrent(item)
            ? { ...item, status: "done", result, error: null }
            : item,
        );
      } catch {
        if (signal.aborted) return;
        update(id, (item) =>
          isCurrent(item)
            ? { ...item, status: "error", error: "convert" }
            : item,
        );
      } finally {
        if (fromPdf) image.close();
      }
    })().finally(() => {
      running.current = null;
      setTick((value) => value + 1);
    });
  }, [items, tick, settings]);

  useEffect(() => {
    const cache = decoded.current;
    return () => cache.forEach((entry) => entry.close());
  }, []);

  return { items, addFiles, removeItem, clearAll, setAlt, setFileName };
}
