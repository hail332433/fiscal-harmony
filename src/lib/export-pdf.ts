import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DashboardData, NotaSimplificada } from "./fiscal-types";
import { fmtBRL, fmtNum } from "./format";

const MARGIN = 40;

function drawCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  sub?: string,
) {
  doc.setDrawColor(220,220,220);
  doc.setFillColor(255,255,255);
  doc.roundedRect(x, y, w, h, 6, 6, "FD");
  doc.setFontSize(8);
  doc.setTextColor(110,110,110);
  doc.text(label.toUpperCase(), x + 10, y + 16);
  doc.setFontSize(14);
  doc.setTextColor(20,20,20);
  doc.text(value, x + 10, y + 38);
  if (sub) {
    doc.setFontSize(8);
    doc.setTextColor(120,120,120);
    doc.text(sub, x + 10, y + 54);
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
  doc.setDrawColor(220,220,220);
  doc.roundedRect(x, y, w, h, 6, 6, "S");
  doc.setFontSize(11);
  doc.setTextColor(20,20,20);
  doc.text(title, x + 12, y + 18);

  if (!data.length) {
    doc.setFontSize(9);
    doc.setTextColor(140,140,140);
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
    doc.setFillColor(79, 70, 229);
    doc.roundedRect(chartX, ry, Math.max(2, bw), barH, 3, 3, "F");
    doc.setFontSize(8);
    doc.setTextColor(60,60,60);
    const label = d.name.length > 22 ? d.name.slice(0, 22) + "…" : d.name;
    doc.text(label, x + 12, ry + barH * 0.7);
    doc.setTextColor(40,40,40);
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
    doc.setDrawColor(200,200,200);
    doc.circle(cx, cy, r, "S");
    doc.setFontSize(9);
    doc.setTextColor(120,120,120);
    doc.text("Sem divergências", cx - 40, cy + 3);
    return;
  }
  const segs = [
    { v: alta, color: [220, 38, 38] as [number, number, number] },
    { v: media, color: [217, 119, 6] as [number, number, number] },
    { v: baixa, color: [22, 163, 74] as [number, number, number] },
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
    // jsPDF não tem polígono direto -> usa triangulação manual
    for (let i = 1; i < pts.length - 1; i++) {
      doc.triangle(
        pts[0][0],
        pts[0][1],
        pts[i][0],
        pts[i][1],
        pts[i + 1][0],
        pts[i + 1][1],
        "F",
      );
    }
    start += angle;
  }
  // Furo central
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, r * 0.55, "F");
  doc.setFontSize(10);
  doc.setTextColor(40,40,40);
  doc.text(String(total), cx - doc.getTextWidth(String(total)) / 2, cy + 3);
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
  doc.setFontSize(18);
  doc.setTextColor(20,20,20);
  doc.text("Relatório Fiscal — Painel Consolidado", MARGIN, 50);
  doc.setFontSize(10);
  doc.setTextColor(110,110,110);
  const dataStr = new Date().toLocaleString("pt-BR");
  doc.text(`Gerado em ${dataStr}  ·  Tempo de processamento: ${(duracaoMs / 1000).toFixed(1)}s`, MARGIN, 68);

  // ===== Cards principais =====
  const { stats, taxCards, riskSummary } = dashboard;
  const cardW = (pageW - MARGIN * 2 - 30) / 4;
  const cardH = 70;
  const cardsY = 90;
  drawCard(doc, MARGIN + 0 * (cardW + 10), cardsY, cardW, cardH, "Total de notas", fmtNum(stats.totalNotas));
  drawCard(doc, MARGIN + 1 * (cardW + 10), cardsY, cardW, cardH, "NF-e (mod. 55)", fmtNum(stats.modelo55));
  drawCard(doc, MARGIN + 2 * (cardW + 10), cardsY, cardW, cardH, "NFC-e (mod. 65)", fmtNum(stats.modelo65));
  drawCard(doc, MARGIN + 3 * (cardW + 10), cardsY, cardW, cardH, "Receita total", fmtBRL(stats.totalRevenue));

  // ===== Tributos =====
  let y = cardsY + cardH + 24;
  doc.setFontSize(12);
  doc.setTextColor(20,20,20);
  doc.text("Tributos consolidados", MARGIN, y);
  y += 10;
  if (taxCards.length) {
    const cols = 5;
    const tW = (pageW - MARGIN * 2 - (cols - 1) * 8) / cols;
    const tH = 56;
    taxCards.slice(0, cols).forEach((t, i) => {
      drawCard(doc, MARGIN + i * (tW + 8), y, tW, tH, t.title, fmtBRL(t.totalValue), `Base: ${fmtBRL(t.totalBase)}`);
    });
    y += tH + 18;
  } else {
    y += 18;
  }

  // ===== Risco fiscal + Top emitentes =====
  const blockH = 170;
  const halfW = (pageW - MARGIN * 2 - 16) / 2;

  // Bloco risco
  doc.setDrawColor(220,220,220);
  doc.roundedRect(MARGIN, y, halfW, blockH, 6, 6, "S");
  doc.setFontSize(11);
  doc.setTextColor(20,20,20);
  doc.text("Risco fiscal", MARGIN + 12, y + 18);
  drawRiskDonut(doc, MARGIN + 90, y + blockH / 2 + 10, 50, riskSummary.alta, riskSummary.media, riskSummary.baixa);
  // Legenda
  const legendX = MARGIN + 170;
  let ly = y + 50;
  const legend = [
    { lbl: "Alta", val: riskSummary.alta, c: [220, 38, 38] },
    { lbl: "Média", val: riskSummary.media, c: [217, 119, 6] },
    { lbl: "Baixa", val: riskSummary.baixa, c: [22, 163, 74] },
  ];
  for (const l of legend) {
    doc.setFillColor(l.c[0], l.c[1], l.c[2]);
    doc.rect(legendX, ly - 8, 10, 10, "F");
    doc.setFontSize(10);
    doc.setTextColor(40,40,40);
    doc.text(`${l.lbl}: ${fmtNum(l.val)}`, legendX + 16, ly);
    ly += 20;
  }

  // Top emitentes
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

  // ===== Página 2+: listagem de notas =====
  doc.addPage();
  doc.setFontSize(14);
  doc.setTextColor(20,20,20);
  doc.text("Listagem de Notas Processadas", MARGIN, 40);
  doc.setFontSize(9);
  doc.setTextColor(110,110,110);
  doc.text(`${fmtNum(notas.length)} notas — valores em BRL`, MARGIN, 56);

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
    styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: MARGIN, right: MARGIN },
    didDrawPage: (data) => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(140,140,140);
      doc.text(`Página ${page}`, pageW - MARGIN, pageH - 20, { align: "right" });
    },
  });

  const fileName = `relatorio-fiscal-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
