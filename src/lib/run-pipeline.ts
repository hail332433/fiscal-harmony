import { useFiscalStore } from "@/store/fiscal-store";
import type { WorkerOutbound } from "./fiscal-types";

let worker: Worker | null = null;

export function startPipeline(file: File) {
  const set = useFiscalStore.getState().set;
  useFiscalStore.getState().reset();
  set({
    state: "uploading",
    fileName: file.name,
    fileSize: file.size,
    message: "Carregando arquivo…",
  });

  if (worker) worker.terminate();
  worker = new Worker(new URL("../workers/fiscal.worker.ts", import.meta.url), {
    type: "module",
  });

  worker.onmessage = (e: MessageEvent<WorkerOutbound>) => {
    const msg = e.data;
    const s = useFiscalStore.getState();
    if (msg.type === "state") {
      s.set({ state: msg.state, message: msg.message ?? s.message });
    } else if (msg.type === "progress") {
      s.set({ processed: msg.processed, total: msg.total, batch: msg.batch });
    } else if (msg.type === "done") {
      s.set({
        dashboard: msg.dashboard,
        notas: msg.notas,
        divergencias: msg.divergencias,
        duracaoMs: msg.duracaoMs,
        state: "finished",
        message: "Concluído",
      });
    } else if (msg.type === "error") {
      s.set({ state: "error", error: msg.message });
    }
  };

  worker.postMessage({ type: "start", file });
}
