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
  applyAutoCorrections: () => { corrigidas: number; restantes: number };
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

export const useFiscalStore = create<FiscalStore>((set, get) => ({
  ...initial,
  set: (p) => set(p),
  setProgress: (p) =>
    set((s) => ({
      phase: p.phase,
      progress: { ...s.progress, [p.phase]: p },
    })),
  applyAutoCorrections: () => {
    const { divergencias, notas, dashboard } = get();
    if (!dashboard) return { corrigidas: 0, restantes: 0 };

    // Chaves cujas divergências NÃO são críticas → podem ser auto-corrigidas
    // (BAIXA, MEDIA e TOTAL_AUSENTE). Críticas (ALTA) permanecem para revisão manual.
    const corrigidasChaves = new Set<string>();
    const restantes = divergencias.filter((d) => {
      if (d.status === "CRITICO") return true;
      corrigidasChaves.add(d.chave);
      return false;
    });

    // Atualiza notas: as corrigidas viram OK, mantendo o valor oficial vindo do XML.
    const novasNotas = notas.map((n) => {
      if (!corrigidasChaves.has(n.chave)) return n;
      return { ...n, divergencia: null, status: null };
    });

    // Recalcula riskSummary
    const risk = { alta: 0, media: 0, baixa: 0 };
    for (const n of novasNotas) {
      if (n.divergencia === "ALTA") risk.alta++;
      else if (n.divergencia === "MEDIA") risk.media++;
      else if (n.divergencia === "BAIXA") risk.baixa++;
    }

    set({
      divergencias: restantes,
      notas: novasNotas,
      dashboard: { ...dashboard, riskSummary: risk },
    });

    return {
      corrigidas: divergencias.length - restantes.length,
      restantes: restantes.length,
    };
  },
  reset: () => set({ ...initial, progress: { ...emptyProgress } }),
}));

