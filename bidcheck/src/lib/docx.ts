import type { Tokens, Token } from "marked";
import { saveBlob } from "./api";

/** 마크다운 제안서 초안 → Word(.docx). 한글(HWP)에서도 열어 편집할 수 있다. */
export async function exportProposalDocx(markdown: string, title: string, filename: string) {
  const { marked } = await import("marked");
  const d = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } = d;

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

  const walk = (tokens: Token[], level = 0) => {
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
                  children: runs((inner as Tokens.Paragraph).tokens, { italics: true }),
                  indent: { left: 360 },
                  border: { left: { style: BorderStyle.SINGLE, size: 12, color: "1F3A5F", space: 8 } },
                }),
              );
          }
          break;
        case "list": {
          const l = t as Tokens.List;
          l.items.forEach((item, i) => {
            const first = item.tokens.find((x) => x.type === "text" || x.type === "paragraph") as Tokens.Text | undefined;
            children.push(
              new Paragraph({
                children: [new TextRun(l.ordered ? `${Number(l.start || 1) + i}. ` : "• "), ...runs(first?.tokens ?? [{ type: "text", raw: item.text, text: item.text } as Tokens.Text])],
                indent: { left: 360 * (level + 1), hanging: 260 },
              }),
            );
            const nested = item.tokens.filter((x) => x.type === "list");
            if (nested.length) walk(nested, level + 1);
          });
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
          children.push(
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [mk(tb.header, true), ...tb.rows.map((r) => mk(r, false))] }),
          );
          children.push(new Paragraph(""));
          break;
        }
        case "code":
          for (const line of (t as Tokens.Code).text.split("\n"))
            children.push(new Paragraph({ children: [new TextRun({ text: line, font: "Consolas" })] }));
          break;
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
  walk(marked.lexer(markdown));

  const doc = new Document({
    styles: { default: { document: { run: { font: "맑은 고딕", size: 21 } } } },
    sections: [{ children }],
  });
  saveBlob(await Packer.toBlob(doc), filename);
}

function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
