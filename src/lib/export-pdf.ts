import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DashboardData, NotaSimplificada } from "./fiscal-types";
import { fmtBRL, fmtNum } from "./format";

const MARGIN = 40;

type RGB = [number, number, number];

// Paleta verde principal (do app)
const BRAND_DARK: RGB = [0, 62, 64]; // #003E40
const BRAND_DEEP: RGB = [0, 89, 91]; // #00595B
const BRAND_MAIN: RGB = [0, 127, 115]; // #007F73
const BRAND_MID: RGB = [0, 158, 132]; // #009E84
const BRAND_LIGHT: RGB = [0, 184, 148]; // #00B894

/** Card sólido em verde escuro com texto branco (legível) */
function drawColorCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  sub: string | undefined,
  color: RGB,
) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(x, y, w, h, 6, 6, "FD");
  // Barra lateral mais clara para acento
  doc.setFillColor(BRAND_LIGHT[0], BRAND_LIGHT[1], BRAND_LIGHT[2]);
  doc.roundedRect(x, y, 4, h, 2, 2, "F");

  doc.setFontSize(8);
  doc.setTextColor(220, 240, 235);
  doc.text(label.toUpperCase(), x + 12, y + 16);
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(value, x + 12, y + 36);
  if (sub) {
    doc.setFontSize(7);
    doc.setTextColor(200, 230, 222);
    doc.text(sub, x + 12, y + 50);
  }
}

function drawBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  data: { name: string; value: number }[],
) {
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(x, y, w, h, 6, 6, "S");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(title, x + 12, y + 18);

  if (!data.length) {
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text("Sem dados.", x + 12, y + 40);
    return;
  }

  const chartX = x + 130;
  const chartY = y + 30;
  const chartW = w - 150;
  const chartH = h - 50;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const rowH = chartH / data.length;
  const barH = Math.min(18, rowH - 6);

  data.forEach((d, i) => {
    const ry = chartY + i * rowH + (rowH - barH) / 2;
    const bw = (d.value / max) * chartW;
    doc.setFillColor(BRAND_MAIN[0], BRAND_MAIN[1], BRAND_MAIN[2]);
    doc.roundedRect(chartX, ry, Math.max(2, bw), barH, 3, 3, "F");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const label = d.name.length > 22 ? d.name.slice(0, 22) + "…" : d.name;
    doc.text(label, x + 12, ry + barH * 0.7);
    doc.setTextColor(40, 40, 40);
    doc.text(fmtBRL(d.value), chartX + bw + 4, ry + barH * 0.7);
  });
}

function drawRiskDonut(
  doc: jsPDF,
  cx: number,
  cy: number,
  r: number,
  alta: number,
  media: number,
  baixa: number,
) {
  const total = alta + media + baixa;
  if (!total) {
    doc.setDrawColor(200, 200, 200);
    doc.circle(cx, cy, r, "S");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Sem divergências", cx - 40, cy + 3);
    return;
  }
  const segs: { v: number; color: RGB }[] = [
    { v: alta, color: [220, 38, 38] },
    { v: media, color: [217, 119, 6] },
    { v: baixa, color: BRAND_MID },
  ];
  let start = -Math.PI / 2;
  for (const s of segs) {
    if (!s.v) continue;
    const angle = (s.v / total) * Math.PI * 2;
    const steps = Math.max(6, Math.round((angle / (Math.PI * 2)) * 64));
    doc.setFillColor(s.color[0], s.color[1], s.color[2]);
    const pts: [number, number][] = [[cx, cy]];
    for (let i = 0; i <= steps; i++) {
      const a = start + (angle * i) / steps;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    for (let i = 1; i < pts.length - 1; i++) {
      doc.triangle(pts[0][0], pts[0][1], pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], "F");
    }
    start += angle;
  }
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, r * 0.55, "F");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(String(total), cx - doc.getTextWidth(String(total)) / 2, cy + 3);
}

// Paleta verde para cards de tributos — alterna entre tons da paleta da marca
const TAX_PALETTE: RGB[] = [BRAND_DARK, BRAND_DEEP, BRAND_MAIN, BRAND_MID, BRAND_LIGHT];
function colorFor(_title: string, idx: number): RGB {
  return TAX_PALETTE[idx % TAX_PALETTE.length];
}

export function exportDashboardPdf(
  dashboard: DashboardData,
  notas: NotaSimplificada[],
  duracaoMs: number,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ===== Cabeçalho =====
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("Relatório Fiscal", MARGIN, 18);

  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text("Painel Consolidado", MARGIN, 58);
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  const dataStr = new Date().toLocaleString("pt-BR");
  doc.text(
    `Gerado em ${dataStr}  ·  Tempo de processamento: ${(duracaoMs / 1000).toFixed(1)}s`,
    MARGIN,
    74,
  );

  // ===== Cards principais (coloridos) =====
  const { stats, taxCards, riskSummary } = dashboard;
  const cardW = (pageW - MARGIN * 2 - 30) / 4;
  const cardH = 64;
  const cardsY = 92;
  drawColorCard(doc, MARGIN + 0 * (cardW + 10), cardsY, cardW, cardH, "Total de notas", fmtNum(stats.totalNotas), undefined, [79, 70, 229]);
  drawColorCard(doc, MARGIN + 1 * (cardW + 10), cardsY, cardW, cardH, "NF-e (mod. 55)", fmtNum(stats.modelo55), undefined, [37, 99, 235]);
  drawColorCard(doc, MARGIN + 2 * (cardW + 10), cardsY, cardW, cardH, "NFC-e (mod. 65)", fmtNum(stats.modelo65), undefined, [14, 165, 233]);
  drawColorCard(doc, MARGIN + 3 * (cardW + 10), cardsY, cardW, cardH, "Receita total", fmtBRL(stats.totalRevenue), undefined, [22, 163, 74]);

  // ===== Tributos consolidados — TODOS os cards (sem corte) =====
  let y = cardsY + cardH + 20;
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text("Tributos consolidados", MARGIN, y);
  y += 8;

  const cols = 5;
  const tW = (pageW - MARGIN * 2 - (cols - 1) * 8) / cols;
  const tH = 56;
  taxCards.forEach((t, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const cx = MARGIN + col * (tW + 8);
    const cy = y + row * (tH + 8);
    drawColorCard(doc, cx, cy, tW, tH, t.title, fmtBRL(t.totalValue), `Base: ${fmtBRL(t.totalBase)}`, colorFor(t.title, i));
  });
  const rows = Math.max(1, Math.ceil(taxCards.length / cols));
  y += rows * (tH + 8) + 12;

  // ===== Risco fiscal + Top emitentes =====
  // Se não couber na primeira página, vai pra próxima
  const blockH = 160;
  if (y + blockH > pageH - 40) {
    doc.addPage();
    y = 50;
  }
  const halfW = (pageW - MARGIN * 2 - 16) / 2;

  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(MARGIN, y, halfW, blockH, 6, 6, "S");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("Risco fiscal", MARGIN + 12, y + 18);
  drawRiskDonut(doc, MARGIN + 90, y + blockH / 2 + 10, 48, riskSummary.alta, riskSummary.media, riskSummary.baixa);

  const legendX = MARGIN + 170;
  let ly = y + 50;
  const legend: { lbl: string; val: number; c: RGB }[] = [
    { lbl: "Alta", val: riskSummary.alta, c: [220, 38, 38] },
    { lbl: "Média", val: riskSummary.media, c: [217, 119, 6] },
    { lbl: "Baixa", val: riskSummary.baixa, c: [22, 163, 74] },
  ];
  for (const l of legend) {
    doc.setFillColor(l.c[0], l.c[1], l.c[2]);
    doc.rect(legendX, ly - 8, 10, 10, "F");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(`${l.lbl}: ${fmtNum(l.val)}`, legendX + 16, ly);
    ly += 20;
  }

  const map = new Map<string, number>();
  for (const n of notas) {
    const k = n.emitente || n.cnpjEmit || "—";
    map.set(k, (map.get(k) ?? 0) + n.valorOficial);
  }
  const top = [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  drawBarChart(doc, MARGIN + halfW + 16, y, halfW, blockH, "Top 5 emitentes por receita", top);

  // ===== Listagem de notas =====
  doc.addPage();
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text("Listagem de Notas Processadas", MARGIN, 40);
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(`${fmtNum(notas.length)} notas — valores em BRL`, MARGIN, 56);

  // Totais para a última linha
  const tot = notas.reduce(
    (acc, n) => {
      acc.valor += n.valorOficial;
      acc.icms += n.vICMS;
      acc.st += n.vST;
      acc.fcp += n.vFCP + n.vFCPST;
      acc.ipi += n.vIPI;
      acc.pis += n.vPIS;
      acc.cofins += n.vCOFINS;
      acc.ibs += n.vIBS;
      acc.cbs += n.vCBS;
      return acc;
    },
    { valor: 0, icms: 0, st: 0, fcp: 0, ipi: 0, pis: 0, cofins: 0, ibs: 0, cbs: 0 },
  );

  autoTable(doc, {
    startY: 70,
    head: [[
      "Chave",
      "Mod.",
      "Nº",
      "Emissão",
      "Emitente",
      "Valor",
      "ICMS",
      "ST",
      "FCP",
      "IPI",
      "PIS",
      "COFINS",
      "IBS",
      "CBS",
    ]],
    body: notas.map((n) => [
      n.chave.slice(-10),
      String(n.modelo),
      n.numero,
      n.emissao,
      (n.emitente || "—").slice(0, 28),
      fmtBRL(n.valorOficial),
      fmtBRL(n.vICMS),
      fmtBRL(n.vST),
      fmtBRL(n.vFCP + n.vFCPST),
      fmtBRL(n.vIPI),
      fmtBRL(n.vPIS),
      fmtBRL(n.vCOFINS),
      fmtBRL(n.vIBS),
      fmtBRL(n.vCBS),
    ]),
    foot: [[
      "TOTAL",
      "",
      "",
      "",
      `${fmtNum(notas.length)} notas`,
      fmtBRL(tot.valor),
      fmtBRL(tot.icms),
      fmtBRL(tot.st),
      fmtBRL(tot.fcp),
      fmtBRL(tot.ipi),
      fmtBRL(tot.pis),
      fmtBRL(tot.cofins),
      fmtBRL(tot.ibs),
      fmtBRL(tot.cbs),
    ]],
    styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 7 },
    footStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    showFoot: "lastPage",
    margin: { left: MARGIN, right: MARGIN },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`Página ${page}`, pageW - MARGIN, pageH - 20, { align: "right" });
    },
  });

  const fileName = `relatorio-fiscal-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
