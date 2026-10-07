import { CheckCircle2, CircleAlert, KeyRound } from "lucide-react";
import { useState } from "react";
import { Button, Card, ErrorBox, Field, Spinner, inputCls } from "../components/ui";
import { api, setPassword } from "../lib/api";
import { useAsync } from "../lib/useAsync";

export interface Health {
  g2b: boolean;
  claude: boolean;
  auth: boolean;
  needsSetup: boolean;
  storage: string;
  model: string;
}

/** 처음 접속 시 전체 화면으로 뜨는 초기 설정 */
export function SetupScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-4 text-center">
          <div className="text-2xl font-bold text-brand-700">BidCheck 초기 설정</div>
          <p className="mt-1 text-sm text-slate-600">처음 한 번만 하면 됩니다. 키는 나중에 [설정] 메뉴에서 넣어도 됩니다.</p>
        </div>
        <SettingsForm firstTime health={null} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data, error, loading, reload } = useAsync(() => api.get<Health>("/health"), []);
  if (loading && !data) return <Spinner />;
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">설정</h1>
      <ErrorBox error={error} />
      {data && (
        <Card title="연결 상태">
          <ul className="space-y-2 text-sm">
            <Status ok={data.auth} label="접속 비밀번호" />
            <Status ok={data.g2b} label="나라장터(공공데이터포털) 키 — 공고 검색" />
            <Status ok={data.claude} label={`Claude API 키 — AI 분석·제안서 (${data.model})`} />
          </ul>
        </Card>
      )}
      <SettingsForm health={data} onSaved={reload} />
    </div>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleAlert className="h-4 w-4 text-amber-600" />}
      {label} <span className={ok ? "text-emerald-700" : "text-amber-700"}>{ok ? "설정됨" : "미설정"}</span>
    </li>
  );
}

function SettingsForm({ firstTime, health, onSaved }: { firstTime?: boolean; health: Health | null; onSaved?: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [claude, setClaude] = useState("");
  const [g2b, setG2b] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (pw !== pw2) return setErr("비밀번호 확인이 일치하지 않습니다.");
    setBusy(true);
    try {
      await api.send("POST", "/setup", { password: pw || undefined, anthropicKey: claude || undefined, g2bKey: g2b || undefined });
      if (pw) setPassword(pw);
      if (firstTime) {
        location.href = "/";
        return;
      }
      setPw("");
      setPw2("");
      setClaude("");
      setG2b("");
      setMsg("저장했습니다.");
      onSaved?.();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> {firstTime ? "비밀번호와 키 입력" : "키·비밀번호 변경"}</span>}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={firstTime ? "접속 비밀번호 (필수, 6자 이상)" : "새 접속 비밀번호 (바꿀 때만)"}>
            <input type="password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} required={firstTime} autoComplete="new-password" />
          </Field>
          <Field label="비밀번호 확인">
            <input type="password" className={inputCls} value={pw2} onChange={(e) => setPw2(e.target.value)} required={firstTime} autoComplete="new-password" />
          </Field>
        </div>
        <Field
          label={`나라장터 키 (공공데이터포털 일반 인증키)${health?.g2b ? " — 설정됨, 바꿀 때만 입력" : ""}`}
          hint="data.go.kr → 마이페이지 → 활용신청 현황 → '조달청_나라장터 입찰공고정보서비스' 의 일반 인증키(Decoding)"
        >
          <input className={inputCls} value={g2b} onChange={(e) => setG2b(e.target.value)} autoComplete="off" />
        </Field>
        <Field
          label={`Claude API 키${health?.claude ? " — 설정됨, 바꿀 때만 입력" : ""}`}
          hint="console.anthropic.com → API Keys 에서 만든 sk-ant- 로 시작하는 키"
        >
          <input className={inputCls} value={claude} onChange={(e) => setClaude(e.target.value)} placeholder="sk-ant-..." autoComplete="off" />
        </Field>
        <ErrorBox error={err} />
        {msg && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
        <Button type="submit" loading={busy} className={firstTime ? "w-full" : ""}>
          저장
        </Button>
        <p className="text-xs text-slate-400">입력한 키는 서버에만 저장되며 화면에 다시 표시되지 않습니다.</p>
      </form>
    </Card>
  );
}
