import { api } from "./api";
import { extractText } from "./extract";

/** 텍스트를 먼저 추출한 뒤 원본과 함께 업로드. 추출 불가 사유(note)를 돌려준다. */
export async function uploadWithText(path: string, file: File, fields: Record<string, string>) {
  const { text, note } = await extractText(file, file.name);
  const form = new FormData();
  form.append("file", file);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (text) form.append("text", text);
  const res = await api.upload<{ id: string }>(path, form);
  return { id: res.id, note };
}

/** 서버에 이미 있는 파일(나라장터에서 내려받은 첨부)의 텍스트를 브라우저에서 추출해 저장 */
export async function backfillText(downloadPath: string, textPath: string, filename: string) {
  const blob = await api.blob(downloadPath);
  const { text, note } = await extractText(blob, filename);
  if (text) await api.putText(textPath, text);
  return note;
}
