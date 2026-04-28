import { create } from "zustand";
import type {
  DashboardData,
  Divergencia,
  NotaSimplificada,
  PipelineState,
} from "@/lib/fiscal-types";

interface FiscalStore {
  state: PipelineState;
  message: string;
  processed: number;
  total: number;
  batch: number;
  fileName: string | null;
  fileSize: number;
  duracaoMs: number;
  dashboard: DashboardData | null;
  notas: NotaSimplificada[];
  divergencias: Divergencia[];
  error: string | null;
  set: (p: Partial<FiscalStore>) => void;
  reset: () => void;
}

const initial = {
  state: "idle" as PipelineState,
  message: "",
  processed: 0,
  total: 0,
  batch: 0,
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
  reset: () => set({ ...initial }),
}));
