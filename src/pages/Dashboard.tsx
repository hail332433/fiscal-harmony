import { useFiscalStore } from "@/store/fiscal-store";
import { Navigate } from "react-router-dom";
import { fmtBRL, fmtNum, fmtDur } from "@/lib/format";
import { FileText, Receipt, TrendingUp, AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const RISK_COLORS = { ALTA: "hsl(var(--destructive))", MEDIA: "hsl(var(--warning))", BAIXA: "hsl(var(--success))" };

function StatCard({ icon: Icon, label, value, sub, accent }: any) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-elegant">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`size-8 rounded-md grid place-items-center ${accent ?? "bg-secondary"}`}>
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold num">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { dashboard, duracaoMs, notas } = useFiscalStore();
  if (!dashboard) return <Navigate to="/upload" replace />;

  const { stats, taxCards, riskSummary } = dashboard;
  const riskData = [
    { name: "Alta", value: riskSummary.alta, key: "ALTA" },
    { name: "Média", value: riskSummary.media, key: "MEDIA" },
    { name: "Baixa", value: riskSummary.baixa, key: "BAIXA" },
  ].filter((r) => r.value > 0);

  return (
    <div className="px-10 py-10 max-w-7xl space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <div className="text-xs font-medium tracking-widest text-primary uppercase">Etapa 2 de 5</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Dashboard fiscal</h1>
          <p className="text-muted-foreground mt-1">Consolidação determinística — XML é soberano.</p>
        </div>
        <div className="text-sm text-muted-foreground">Processado em {fmtDur(duracaoMs)}</div>
      </header>

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Total de notas" value={fmtNum(stats.totalNotas)} accent="bg-primary/10 text-primary" />
        <StatCard icon={Receipt} label="📄 NF-e (mod. 55)" value={fmtNum(stats.modelo55)} accent="bg-accent/10 text-accent" />
        <StatCard icon={Receipt} label="🧾 NFC-e (mod. 65)" value={fmtNum(stats.modelo65)} accent="bg-accent/10 text-accent" />
        <StatCard icon={TrendingUp} label="Receita total" value={fmtBRL(stats.totalRevenue)} accent="bg-success/15 text-success" />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Tributos consolidados</h2>
        {taxCards.length === 0 ? (
          <div className="text-sm text-muted-foreground rounded-lg border bg-card p-6">Nenhum tributo identificado nas notas.</div>
        ) : (
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            {taxCards.map((t) => (
              <div key={t.title} className="rounded-xl border bg-card p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{t.title}</div>
                <div className="mt-2 text-xl font-semibold num">{fmtBRL(t.totalValue)}</div>
                <div className="text-xs text-muted-foreground mt-1 num">Base: {fmtBRL(t.totalBase)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Risco fiscal</h2>
            <ShieldAlert className="size-4 text-muted-foreground" />
          </div>
          {riskData.length === 0 ? (
            <div className="flex items-center gap-3 text-success py-10 justify-center">
              <ShieldCheck className="size-5" /> Nenhuma divergência detectada.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={riskData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {riskData.map((d) => <Cell key={d.key} fill={RISK_COLORS[d.key as keyof typeof RISK_COLORS]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 mt-2 text-center text-sm">
            <div><div className="text-destructive font-semibold num">{fmtNum(riskSummary.alta)}</div><div className="text-xs text-muted-foreground">Alta</div></div>
            <div><div className="text-warning font-semibold num">{fmtNum(riskSummary.media)}</div><div className="text-xs text-muted-foreground">Média</div></div>
            <div><div className="text-success font-semibold num">{fmtNum(riskSummary.baixa)}</div><div className="text-xs text-muted-foreground">Baixa</div></div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" /> Top 5 emitentes por receita
          </h2>
          <TopEmitentes notas={notas} />
        </div>
      </section>
    </div>
  );
}

function TopEmitentes({ notas }: { notas: any[] }) {
  const map = new Map<string, number>();
  for (const n of notas) {
    const k = n.emitente || n.cnpjEmit || "—";
    map.set(k, (map.get(k) ?? 0) + n.valorOficial);
  }
  const data = [...map.entries()]
    .map(([name, value]) => ({ name: name.length > 22 ? name.slice(0, 22) + "…" : name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            formatter={(v: any) => fmtBRL(v as number)}
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
          />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
