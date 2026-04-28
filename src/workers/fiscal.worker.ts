/// <reference lib="webworker" />
import { Unzip, UnzipInflate } from "fflate";
import { XMLParser } from "fast-xml-parser";
import type {
  DashboardData,
  Divergencia,
  NotaSimplificada,
  Severity,
  WorkerInbound,
  WorkerOutbound,
} from "@/lib/fiscal-types";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: WorkerOutbound) => ctx.postMessage(m);

const BATCH_SIZE = 5000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v));
  return isFinite(n) ? n : 0;
};

const taxKeys = ["ICMS", "PIS", "COFINS", "IPI", "ISSQN"] as const;
type TaxKey = typeof taxKeys[number];

interface Aggregates {
  totalNotas: number;
  modelo55: number;
  modelo65: number;
  totalRevenue: number;
  taxes: Record<TaxKey, { totalValue: number; totalBase: number }>;
  risk: { alta: number; media: number; baixa: number };
}

function newAgg(): Aggregates {
  const taxes = {} as Aggregates["taxes"];
  taxKeys.forEach((k) => (taxes[k] = { totalValue: 0, totalBase: 0 }));
  return {
    totalNotas: 0,
    modelo55: 0,
    modelo65: 0,
    totalRevenue: 0,
    taxes,
    risk: { alta: 0, media: 0, baixa: 0 },
  };
}

function classify(diff: number): Severity {
  const d = Math.abs(diff);
  if (d <= 0.01) return "BAIXA";
  if (d <= 5.0) return "MEDIA";
  return "ALTA";
}

function asArray<T>(x: T | T[] | undefined): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

interface Processed {
  nota: NotaSimplificada;
  divergencias: Divergencia[];
  taxes: Partial<Record<TaxKey, { v: number; b: number }>>;
}

function processXml(xmlText: string): Processed | null {
  let doc: any;
  try {
    doc = parser.parse(xmlText);
  } catch {
    return null;
  }
  const nfeProc = doc?.nfeProc ?? doc;
  const NFe = nfeProc?.NFe ?? nfeProc?.nfe;
  if (!NFe) return null;
  const inf = NFe.infNFe ?? NFe.infnfe;
  if (!inf) return null;

  const ide = inf.ide ?? {};
  const emit = inf.emit ?? {};
  const dest = inf.dest ?? {};
  const total = inf.total ?? {};
  const ICMSTot = total.ICMSTot;

  const chave = String(inf.Id ?? "").replace(/^NFe/i, "") || "";
  const mod = parseInt(String(ide.mod ?? "55"), 10) === 65 ? 65 : 55;

  const dets = asArray<any>(inf.det);
  let somaItens = 0;
  const localTax: Processed["taxes"] = {};

  for (const det of dets) {
    const prod = det.prod ?? {};
    somaItens += num(prod.vProd);
    const imposto = det.imposto ?? {};
    // ICMS — varia muito (ICMS00, ICMS10...)
    const icmsBlock = imposto.ICMS;
    if (icmsBlock && typeof icmsBlock === "object") {
      for (const k of Object.keys(icmsBlock)) {
        const node = (icmsBlock as any)[k];
        if (node && typeof node === "object") {
          const v = num(node.vICMS);
          const b = num(node.vBC);
          if (v || b) {
            localTax.ICMS = localTax.ICMS ?? { v: 0, b: 0 };
            localTax.ICMS.v += v;
            localTax.ICMS.b += b;
          }
        }
      }
    }
    const pisNode = imposto.PIS;
    if (pisNode && typeof pisNode === "object") {
      for (const k of Object.keys(pisNode)) {
        const node = (pisNode as any)[k];
        if (node && typeof node === "object") {
          const v = num(node.vPIS);
          const b = num(node.vBC);
          if (v || b) {
            localTax.PIS = localTax.PIS ?? { v: 0, b: 0 };
            localTax.PIS.v += v;
            localTax.PIS.b += b;
          }
        }
      }
    }
    const cofinsNode = imposto.COFINS;
    if (cofinsNode && typeof cofinsNode === "object") {
      for (const k of Object.keys(cofinsNode)) {
        const node = (cofinsNode as any)[k];
        if (node && typeof node === "object") {
          const v = num(node.vCOFINS);
          const b = num(node.vBC);
          if (v || b) {
            localTax.COFINS = localTax.COFINS ?? { v: 0, b: 0 };
            localTax.COFINS.v += v;
            localTax.COFINS.b += b;
          }
        }
      }
    }
    const ipiNode = imposto.IPI;
    if (ipiNode?.IPITrib) {
      const v = num(ipiNode.IPITrib.vIPI);
      const b = num(ipiNode.IPITrib.vBC);
      if (v || b) {
        localTax.IPI = localTax.IPI ?? { v: 0, b: 0 };
        localTax.IPI.v += v;
        localTax.IPI.b += b;
      }
    }
    if (imposto.ISSQN) {
      const v = num(imposto.ISSQN.vISSQN);
      const b = num(imposto.ISSQN.vBC);
      if (v || b) {
        localTax.ISSQN = localTax.ISSQN ?? { v: 0, b: 0 };
        localTax.ISSQN.v += v;
        localTax.ISSQN.b += b;
      }
    }
  }

  const temICMSTot = !!ICMSTot;
  const valorDeclarado = temICMSTot ? num(ICMSTot.vNF) : null;
  const valorOficial = temICMSTot ? (valorDeclarado as number) : somaItens;
  const fonte = temICMSTot ? "ICMSTot" : "TOTAL_AUSENTE";

  const divergencias: Divergencia[] = [];
  let gravidadeNota: Severity | null = null;
  let statusNota: Processed["nota"]["status"] = null;

  if (temICMSTot) {
    const diff = somaItens - (valorDeclarado as number);
    if (Math.abs(diff) > 0.001) {
      const grav = classify(diff);
      const status = grav === "ALTA" ? "CRITICO" : "CORRIGIDO";
      gravidadeNota = grav;
      statusNota = status;
      divergencias.push({
        chave,
        tipo: "TOTAL_DIVERGENTE",
        campo: "vNF",
        valorCalculado: somaItens,
        valorDeclarado: valorDeclarado as number,
        diferenca: diff,
        gravidade: grav,
        status,
      });
    }
  } else {
    gravidadeNota = "MEDIA";
    statusNota = "CORRIGIDO";
    divergencias.push({
      chave,
      tipo: "TOTAL_AUSENTE",
      campo: "ICMSTot",
      valorCalculado: somaItens,
      valorDeclarado: 0,
      diferenca: somaItens,
      gravidade: "MEDIA",
      status: "CORRIGIDO",
    });
  }

  const nota: NotaSimplificada = {
    chave,
    modelo: mod as 55 | 65,
    numero: String(ide.nNF ?? ""),
    serie: String(ide.serie ?? ""),
    emissao: String(ide.dhEmi ?? ide.dEmi ?? ""),
    emitente: String(emit.xNome ?? ""),
    cnpjEmit: String(emit.CNPJ ?? emit.CPF ?? ""),
    destinatario: String(dest.xNome ?? ""),
    valorOficial,
    valorDeclarado,
    valorItens: somaItens,
    qtdItens: dets.length,
    divergencia: gravidadeNota,
    status: statusNota,
    fonte,
  };

  return { nota, divergencias, taxes: localTax };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const buf = await crypto.subtle.digest("SHA-256", ab);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const decoder = new TextDecoder("utf-8", { fatal: false });

async function run(file: File) {
  const start = performance.now();
  post({ type: "state", state: "uploaded" });
  post({ type: "state", state: "extracting", message: "Lendo ZIP em streaming…" });

  const agg = newAgg();
  const notas: NotaSimplificada[] = [];
  const divergencias: Divergencia[] = [];
  const seen = new Set<string>();

  let batch: Uint8Array[] = [];
  let totalDiscovered = 0;
  let processed = 0;
  let batchIndex = 0;

  const flushBatch = async () => {
    if (!batch.length) return;
    batchIndex += 1;
    post({ type: "state", state: "processing", message: `Lote ${batchIndex} (${batch.length} XMLs)` });
    for (const bytes of batch) {
      const hash = await sha256Hex(bytes);
      if (seen.has(hash)) {
        processed++;
        continue;
      }
      seen.add(hash);
      const text = decoder.decode(bytes);
      const r = processXml(text);
      processed++;
      if (!r) continue;
      agg.totalNotas++;
      if (r.nota.modelo === 55) agg.modelo55++;
      else agg.modelo65++;
      agg.totalRevenue += r.nota.valorOficial;
      for (const k of Object.keys(r.taxes) as (keyof typeof r.taxes)[]) {
        const t = r.taxes[k]!;
        agg.taxes[k].totalValue += t.v;
        agg.taxes[k].totalBase += t.b;
      }
      if (r.nota.divergencia === "ALTA") agg.risk.alta++;
      else if (r.nota.divergencia === "MEDIA") agg.risk.media++;
      else if (r.nota.divergencia === "BAIXA") agg.risk.baixa++;
      notas.push(r.nota);
      for (const d of r.divergencias) divergencias.push(d);
    }
    batch = []; // libera referências do lote (GC)
    post({ type: "progress", processed, total: totalDiscovered, batch: batchIndex });
    // cede o event loop
    await new Promise((r) => setTimeout(r, 0));
  };

  // streaming unzip
  await new Promise<void>((resolve, reject) => {
    const unzip = new Unzip((stream) => {
      if (!stream.name.toLowerCase().endsWith(".xml")) {
        stream.ondata = () => {};
        stream.start();
        return;
      }
      totalDiscovered++;
      const chunks: Uint8Array[] = [];
      stream.ondata = (err, data, final) => {
        if (err) return reject(err);
        if (data && data.length) chunks.push(data);
        if (final) {
          let total = 0;
          for (const c of chunks) total += c.length;
          const merged = new Uint8Array(total);
          let o = 0;
          for (const c of chunks) {
            merged.set(c, o);
            o += c.length;
          }
          batch.push(merged);
          if (batch.length >= BATCH_SIZE) {
            // pausa para drenar batch sincronicamente via microtask
            queueMicrotask(() => {
              flushBatch().catch(reject);
            });
          }
        }
      };
      stream.start();
    });
    unzip.register(UnzipInflate);

    const reader = file.stream().getReader();
    const pump = (): Promise<void> =>
      reader.read().then(({ done, value }) => {
        if (done) {
          unzip.push(new Uint8Array(0), true);
          return;
        }
        unzip.push(value!, false);
        return pump();
      });
    pump().then(resolve).catch(reject);
  });

  await flushBatch();

  post({ type: "state", state: "consolidating", message: "Consolidando indicadores…" });

  const dashboard: DashboardData = {
    stats: {
      totalNotas: agg.totalNotas,
      modelo55: agg.modelo55,
      modelo65: agg.modelo65,
      totalRevenue: agg.totalRevenue,
    },
    taxCards: taxKeys
      .map((k) => ({ title: k, totalValue: agg.taxes[k].totalValue, totalBase: agg.taxes[k].totalBase }))
      .filter((c) => c.totalValue > 0 || c.totalBase > 0),
    riskSummary: agg.risk,
    screensOrder: ["Upload", "Dashboard", "Notas", "Auditoria", "Divergências"],
  };

  post({ type: "state", state: "finished" });
  post({
    type: "done",
    dashboard,
    notas,
    divergencias,
    duracaoMs: performance.now() - start,
  });
}

ctx.onmessage = (e: MessageEvent<WorkerInbound>) => {
  const msg = e.data;
  if (msg.type === "start") {
    run(msg.file).catch((err) => post({ type: "error", message: String(err?.message ?? err) }));
  }
};
