import { Marked } from "marked";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// AI 출력에는 외부 문서 내용이 섞이므로 원시 HTML 은 렌더링하지 않고 그대로 보여준다
const md = new Marked({ gfm: true, breaks: true });
md.use({ renderer: { html: ({ text }) => esc(text) } });

export function renderMarkdown(src: string) {
  return md.parse(src, { async: false });
}
