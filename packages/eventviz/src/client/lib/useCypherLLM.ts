import { useCallback, useEffect, useRef, useState } from "react";

export type LLMStatus = "idle" | "loading" | "ready" | "generating" | "error";

export interface LLMProgress {
  file?: string;
  /** 0..100 */
  percent?: number;
}

interface PendingRequest {
  resolve: (cypher: string) => void;
  reject: (err: Error) => void;
}

export interface CypherLLM {
  status: LLMStatus;
  progress: LLMProgress | null;
  error: string | null;
  /** True if model files were already in the browser cache on this load. */
  fromCache: boolean;
  load: () => void;
  generate: (text: string) => Promise<string>;
}

export function useCypherLLM(): CypherLLM {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef<Map<string, PendingRequest>>(new Map());
  const [status, setStatus] = useState<LLMStatus>("idle");
  const [progress, setProgress] = useState<LLMProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const ensureWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(
      new URL("./cypherLLM.worker.ts", import.meta.url),
      { type: "module" },
    );
    w.addEventListener("message", (event) => {
      const data = event.data as
        | { type: "PROGRESS"; payload: { status: string; file?: string; progress?: number } }
        | { type: "CACHE_STATUS"; payload: { fromCache: boolean } }
        | { type: "READY"; id?: string }
        | { type: "RESULT"; id: string; payload: { cypher: string; raw: string } }
        | { type: "ERROR"; id?: string; payload: { message: string } };

      if (data.type === "CACHE_STATUS") {
        setFromCache(data.payload.fromCache);
        return;
      }
      if (data.type === "PROGRESS") {
        const p = data.payload;
        // Always update if the worker sent an aggregated percent — that way
        // a per-file `done` event still reflects the overall progress instead
        // of clearing the bar.
        if (typeof p.progress === "number") {
          setProgress({ file: p.file, percent: p.progress });
        }
        if (
          p.status === "progress" ||
          p.status === "initiate" ||
          p.status === "download" ||
          p.status === "done"
        ) {
          setStatus((s) =>
            s === "ready" || s === "generating" ? s : "loading",
          );
        }
        // We deliberately don't clear progress here; the final `READY`
        // message below clears it once the pipeline is fully built.
      } else if (data.type === "READY") {
        setStatus("ready");
        setProgress(null);
        setError(null);
      } else if (data.type === "RESULT") {
        const req = pending.current.get(data.id);
        if (req) {
          req.resolve(data.payload.cypher);
          pending.current.delete(data.id);
        }
        setStatus("ready");
      } else if (data.type === "ERROR") {
        const msg = data.payload.message;
        setError(msg);
        if (data.id) {
          const req = pending.current.get(data.id);
          if (req) {
            req.reject(new Error(msg));
            pending.current.delete(data.id);
          }
          setStatus("ready");
        } else {
          setStatus("error");
        }
      }
    });
    w.addEventListener("error", (e) => {
      setError(e.message);
      setStatus("error");
    });
    workerRef.current = w;
    return w;
  }, []);

  const load = useCallback(() => {
    if (status === "loading" || status === "ready" || status === "generating") return;
    const w = ensureWorker();
    setStatus("loading");
    setError(null);
    w.postMessage({ type: "INIT" });
  }, [ensureWorker, status]);

  const generate = useCallback(
    (text: string): Promise<string> => {
      const w = ensureWorker();
      const id = Math.random().toString(36).slice(2);
      setStatus("generating");
      setError(null);
      return new Promise<string>((resolve, reject) => {
        pending.current.set(id, { resolve, reject });
        w.postMessage({ type: "GENERATE", id, payload: { text } });
      });
    },
    [ensureWorker],
  );

  return { status, progress, error, fromCache, load, generate };
}
