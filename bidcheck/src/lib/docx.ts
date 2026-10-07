import type { Token, Tokens } from "marked";
import { createElement } from "react";
import { saveBlob } from "./api";
import { SERIES } from "./palette";

/* ───────────── 다이어그램·차트 → PNG ───────────── */

async function svgToPng(svg: string, maxWidth = 1200): Promise<{ data: Uint8Array; width: number; height: number }> {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const el = doc.documentElement;
  const vb = el.getAttribute("viewBox")?.split(/[\s,]+/).map(Number);
  const px = (a: string | null) => (a && !a.trim().endsWith("%") ? Number.parseFloat(a) : Number.NaN);
  let w = px(el.getAttribute("width")) || vb?.[2] || 800;
  let h = px(el.getAttribute("height")) || vb?.[3] || 400;
  if (w > maxWidth) {
    h = (h * maxWidth) / w;
    w = maxWidth;
  }
  el.setAttribute("width", String(w));
  el.setAttribute("height", String(h));
  el.removeAttribute("style");
  if (!el.getAttribute("xmlns")) el.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(el))}`;
  const img = new Image();
  await new Promise<void>((ok, fail) => {
    img.onload = () => ok();
    img.onerror = () => fail(new Error("이미지 변환 실패"));
    img.src = src;
  });
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * scale);
  canvas.height = Math.ceil(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b!), "image/png"));
  return { data: new Uint8Array(await blob.arrayBuffer()), width: w, height: h };
}

export async function chartToSvg(code: string): Promise<string | null> {
  const [{ ChartSvg, parseChart }, { createRoot }, { flushSync }] = await Promise.all([
    import("../components/RichMarkdown"),
    import("react-dom/client"),
    import("react-dom"),
  ]);
  const spec = parseChart(code);
  if (!spec) return null;
  const W = 640;
  const H = 300;
  // 화면 밖 임시 영역에 그려 SVG 를 얻는다
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${W}px;height:${H}px;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  let svg: string | undefined;
  try {
    flushSync(() => root.render(createElement(ChartSvg, { spec, width: W, height: H, animate: false })));
    // 막대·조각·선이 실제로 그려질 때까지 기다린다 (최대 3초)
    const drawn = ".recharts-bar-rectangle path, .recharts-pie-sector path, .recharts-line-curve, .recharts-radar-polygon";
    for (let i = 0; i < 60 && !host.querySelector(drawn); i++) await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 150));
    svg = host.querySelector(".recharts-wrapper > svg.recharts-surface")?.outerHTML;
  } finally {
    root.unmount();
    host.remove();
  }
  if (!svg) return null;
  // 범례(HTML)는 이미지에 들어가지 않으므로 SVG 범례와 제목을 직접 덧붙인다
  const names =
    spec.type === "pie"
      ? spec.data.slice(0, SERIES.length).map((d) => String(d[spec.xKey ?? "name"]))
      : (spec.series?.length ? spec.series : [{ key: "value", name: "값" }]).map((s) => s.name ?? s.key);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const legend = names
    .map((n, i) => `<g transform="translate(${20 + (i % 4) * 150},${H + 14 + Math.floor(i / 4) * 18})"><rect width="10" height="10" rx="2" fill="${SERIES[i]}"/><text x="16" y="9" font-size="11" fill="#52514e">${esc(n)}</text></g>`)
    .join("");
  const extraH = 24 + Math.ceil(names.length / 4) * 18;
  const title = spec.title ? `<text x="${W / 2}" y="16" text-anchor="middle" font-size="13" font-weight="600" fill="#0b0b0b">${esc(spec.title)}</text>` : "";
  const top = spec.title ? 24 : 0;
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + extraH + top}" viewBox="0 0 ${W} ${H + extraH + top}" font-family="Malgun Gothic, sans-serif">${title}<g transform="translate(0,${top})">${inner}${legend}</g></svg>`;
}

/* ───────────── 마크다운 → Word ───────────── */

/** 제안서 초안(마크다운 + 다이어그램·차트) → Word(.docx). 한글(HWP)에서도 열어 편집할 수 있다. */
export async function exportProposalDocx(markdown: string, title: string, filename: string, onProgress?: (s: string) => void) {
  const { marked } = await import("marked");
  const d = await import("docx");
  const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } = d;
  const { mermaidSvg } = await import("../components/RichMarkdown");

  const runs = (tokens: Token[] | undefined, style: { bold?: boolean; italics?: boolean } = {}): InstanceType<typeof TextRun>[] => {
    const out: InstanceType<typeof TextRun>[] = [];
    for (const t of tokens ?? []) {
      if (t.type === "strong") out.push(...runs((t as Tokens.Strong).tokens, { ...style, bold: true }));
      else if (t.type === "em") out.push(...runs((t as Tokens.Em).tokens, { ...style, italics: true }));
      else if (t.type === "codespan") out.push(new TextRun({ text: (t as Tokens.Codespan).text, font: "Consolas", ...style }));
      else if (t.type === "br") out.push(new TextRun({ text: "", break: 1 }));
      else if ("tokens" in t && Array.isArray(t.tokens)) out.push(...runs(t.tokens, style));
      else out.push(new TextRun({ text: decode("text" in t ? String(t.text) : t.raw), ...style }));
    }
    return out;
  };

  const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
  const border = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)] }),
  ];

  const image = async (svg: string | null) => {
    if (!svg) return;
    const png = await svgToPng(svg);
    const maxW = 600; // 본문 폭(px)
    const w = Math.min(maxW, png.width);
    const h = (png.height * w) / png.width;
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: "png", data: png.data, transformation: { width: w, height: h } })],
        spacing: { before: 120, after: 120 },
      }),
    );
  };

  let figure = 0;
  const walk = async (tokens: Token[], level = 0) => {
    for (const t of tokens) {
      switch (t.type) {
        case "heading": {
          const h = t as Tokens.Heading;
          children.push(new Paragraph({ heading: HEADINGS[h.depth - 1], children: runs(h.tokens) }));
          break;
        }
        case "paragraph":
          children.push(new Paragraph({ children: runs((t as Tokens.Paragraph).tokens), spacing: { after: 120 } }));
          break;
        case "blockquote":
          for (const inner of (t as Tokens.Blockquote).tokens) {
            if (inner.type === "paragraph")
              children.push(
                new Paragraph({
                  children: runs((inner as Tokens.Paragraph).tokens, { bold: true }),
                  indent: { left: 240 },
                  shading: { fill: "EEF3F9" },
                  border: { left: { style: BorderStyle.SINGLE, size: 18, color: "2F5D8F", space: 8 } },
                  spacing: { before: 80, after: 120 },
                }),
              );
          }
          break;
        case "list": {
          const l = t as Tokens.List;
          for (const [i, item] of l.items.entries()) {
            const first = item.tokens.find((x) => x.type === "text" || x.type === "paragraph") as Tokens.Text | undefined;
            children.push(
              new Paragraph({
                children: [new TextRun(l.ordered ? `${Number(l.start || 1) + i}. ` : "• "), ...runs(first?.tokens ?? [{ type: "text", raw: item.text, text: item.text } as Tokens.Text])],
                indent: { left: 360 * (level + 1), hanging: 260 },
              }),
            );
            const nested = item.tokens.filter((x) => x.type === "list");
            if (nested.length) await walk(nested, level + 1);
          }
          break;
        }
        case "table": {
          const tb = t as Tokens.Table;
          const mk = (cells: Tokens.TableCell[], header: boolean) =>
            new TableRow({
              tableHeader: header,
              children: cells.map(
                (c) =>
                  new TableCell({
                    children: [new Paragraph({ children: runs(c.tokens, header ? { bold: true } : {}) })],
                    shading: header ? { fill: "E8EEF5" } : undefined,
                    borders: { top: border, bottom: border, left: border, right: border },
                  }),
              ),
            });
          children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [mk(tb.header, true), ...tb.rows.map((r) => mk(r, false))] }));
          children.push(new Paragraph(""));
          break;
        }
        case "code": {
          const c = t as Tokens.Code;
          if (c.lang === "mermaid" || c.lang === "chart") {
            figure++;
            onProgress?.(`그림 ${figure} 변환 중…`);
            try {
              const svg = c.lang === "mermaid" ? await mermaidSvg(c.text) : await chartToSvg(c.text);
              if (!svg) throw new Error("empty");
              await image(svg);
            } catch {
              children.push(new Paragraph({ children: [new TextRun({ text: `[그림 ${figure} 변환 실패]`, italics: true })] }));
            }
            break;
          }
          for (const line of c.text.split("\n")) children.push(new Paragraph({ children: [new TextRun({ text: line, font: "Consolas" })] }));
          break;
        }
        case "hr":
          children.push(new Paragraph({ border: { bottom: border } }));
          break;
        case "space":
          break;
        default:
          if (t.raw.trim()) children.push(new Paragraph(decode(t.raw.trim())));
      }
    }
  };
  await walk(marked.lexer(markdown));

  onProgress?.("Word 파일 만드는 중…");
  const doc = new Document({
    styles: { default: { document: { run: { font: "맑은 고딕", size: 21 } } } },
    sections: [{ children }],
  });
  saveBlob(await Packer.toBlob(doc), filename);
}

function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
