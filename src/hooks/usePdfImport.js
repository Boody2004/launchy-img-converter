import { useCallback, useEffect, useRef, useState } from "react";
import { readPdf } from "../lib/pdf.js";

let nextErrorId = 1;

export function usePdfImport(addFiles) {
  const [progress, setProgress] = useState(null);
  const [errors, setErrors] = useState([]);
  const queue = useRef(Promise.resolve());
  const controller = useRef(new AbortController());
  const pending = useRef(0);

  const cancel = useCallback(() => {
    controller.current.abort();
    controller.current = new AbortController();
    setProgress(null);
    setErrors([]);
  }, []);

  const importPdf = useCallback(
    (file) => {
      const { signal } = controller.current;
      if (pending.current === 0) setErrors([]);
      pending.current += 1;

      queue.current = queue.current.then(async () => {
        try {
          if (signal.aborted) return;
          setProgress({ name: file.name });
          await readPdf(file, {
            signal,
            onPage: (image, page, total) => {
              if (signal.aborted) return;
              if (image) addFiles([image], { fromPdf: true });
              else setProgress({ name: file.name, page, total });
            },
          });
        } catch (error) {
          if (signal.aborted) return;
          const key =
            error?.name === "PasswordException" ? "pdfLocked" : "pdfError";
          setErrors((list) => [
            ...list,
            { id: nextErrorId++, key, name: file.name },
          ]);
        } finally {
          pending.current -= 1;
          if (pending.current === 0) setProgress(null);
        }
      });
    },
    [addFiles],
  );

  useEffect(() => () => controller.current.abort(), []);

  return { importPdf, cancel, progress, errors };
}
