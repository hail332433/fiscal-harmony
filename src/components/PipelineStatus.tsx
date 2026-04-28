import { useFiscalStore } from "@/store/fiscal-store";
import { Progress } from "@/components/ui/progress";

export default function PipelineStatus() {
  const { state, message, processed, total, batch } = useFiscalStore();
  if (state === "idle" || state === "finished" || state === "error") return null;
  const pct = total ? Math.min(100, (processed / total) * 100) : null;
  return (
    <div className="rounded-xl border bg-card p-5 shadow-elegant">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Pipeline</div>
          <div className="font-medium">{message || state}</div>
        </div>
        <div className="text-xs font-mono px-2 py-1 rounded bg-secondary text-secondary-foreground">
          {state}
        </div>
      </div>
      {pct !== null ? (
        <>
          <Progress value={pct} className="h-2" />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground num">
            <span>{processed.toLocaleString("pt-BR")} / {total.toLocaleString("pt-BR")} XMLs</span>
            <span>Lote {batch}</span>
          </div>
        </>
      ) : (
        <div className="h-2 rounded bg-secondary overflow-hidden relative">
          <div className="absolute inset-y-0 w-1/3 bg-gradient-primary animate-[slide_1.4s_ease-in-out_infinite]" />
          <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
        </div>
      )}
    </div>
  );
}
