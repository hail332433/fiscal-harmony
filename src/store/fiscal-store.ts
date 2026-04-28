import { create } from "zustand";
import type {
  DashboardData,
  Divergencia,
  NotaSimplificada,
  PipelinePhase,
  PipelineState,
} from "@/lib/fiscal-types";

interface PhaseProgress {
  phase: PipelinePhase;
  current: number;
  total: number;
  batch?: number;
}

interface FiscalStore {
  state: PipelineState;
  message: string;
  phase: PipelinePhase;
  progress: Record<PipelinePhase, PhaseProgress>;
  fileName: string | null;
  fileSize: number;
  duracaoMs: number;
  dashboard: DashboardData | null;
  notas: NotaSimplificada[];
  divergencias: Divergencia[];
  error: string | null;
  set: (p: Partial<FiscalStore>) => void;
  setProgress: (p: PhaseProgress) => void;
  reset: () => void;
}

const emptyProgress: Record<PipelinePhase, PhaseProgress> = {
  upload: { phase: "upload", current: 0, total: 0 },
  extract: { phase: "extract", current: 0, total: 0 },
  process: { phase: "process", current: 0, total: 0 },
  consolidate: { phase: "consolidate", current: 0, total: 0 },
};

const initial = {
  state: "idle" as PipelineState,
  message: "",
  phase: "upload" as PipelinePhase,
  progress: emptyProgress,
  fileName: null,
  fileSize: 0,
  duracaoMs: 0,
  dashboard: null,
  notas: [],
  divergencias: [],
  error: null,
};

export const useFiscalStore = create<FiscalStore>((set) => ({
  ...initial,
  set: (p) => set(p),
  setProgress: (p) =>
    set((s) => ({
      phase: p.phase,
      progress: { ...s.progress, [p.phase]: p },
    })),
  reset: () => set({ ...initial, progress: { ...emptyProgress } }),
}));
