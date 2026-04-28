import { NavLink, Outlet } from "react-router-dom";
import { useFiscalStore } from "@/store/fiscal-store";
import { ShieldCheck, Upload, LayoutDashboard, FileText, Search, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/notas", label: "Notas", icon: FileText },
  { to: "/auditoria", label: "Auditoria", icon: Search },
  { to: "/divergencias", label: "Divergências", icon: AlertTriangle },
];

export default function AppShell() {
  const { state, progress, dashboard } = useFiscalStore();
  const proc = progress.process;
  const hasData = !!dashboard;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-6 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-gradient-accent grid place-items-center shadow-elegant">
              <ShieldCheck className="size-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold tracking-tight">Fiscal Extractor</div>
              <div className="text-xs text-sidebar-foreground/60">NF-e · NFC-e · Alta escala</div>
            </div>
          </div>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {items.map((it, i) => {
            const disabled = it.to !== "/upload" && !hasData;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                onClick={(e) => disabled && e.preventDefault()}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80",
                    disabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
                  )
                }
              >
                <span className="text-xs text-sidebar-foreground/50 w-4">{i + 1}.</span>
                <it.icon className="size-4" />
                <span>{it.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-sidebar-border text-xs text-sidebar-foreground/60">
          <div className="flex justify-between"><span>Pipeline</span><span className="font-mono">{state}</span></div>
          {proc.total > 0 && (
            <div className="mt-1 num">{proc.current.toLocaleString("pt-BR")} / {proc.total.toLocaleString("pt-BR")} XMLs</div>
          )}
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
