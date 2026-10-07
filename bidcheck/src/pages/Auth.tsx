import { KeyRound, LogIn, Mail, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, ErrorBox, Field, inputCls } from "../components/ui";
import { api, setToken } from "../lib/api";

function Shell({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="text-2xl font-bold text-brand-700">BidCheck</div>
          <div className="text-sm text-slate-500">나라장터 입찰 분석</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          {sub && <p className="mt-1 text-sm text-slate-600">{sub}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** 최초 1회: 관리자 계정 만들기 */
export function SetupScreen() {
  const [f, setF] = useState({ id: "", name: "", email: "", password: "", password2: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  return (
    <Shell title="관리자 계정 만들기" sub="처음 한 번만 합니다. 이 계정으로 다른 직원 계정을 등록할 수 있습니다.">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          if (f.password !== f.password2) return setErr("비밀번호 확인이 일치하지 않습니다.");
          setBusy(true);
          try {
            const r = await api.send<{ token: string }>("POST", "/auth/setup", f);
            setToken(r.token);
            location.href = "/settings";
          } catch (e2) {
            setErr(e2);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="아이디 (영문 소문자·숫자)">
          <input className={inputCls} value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} required autoComplete="username" />
        </Field>
        <Field label="이름">
          <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </Field>
        <Field label="이메일 (비밀번호 분실 시 임시 비밀번호를 받을 주소)">
          <input type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        </Field>
        <Field label="비밀번호 (8자 이상)">
          <input type="password" className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required autoComplete="new-password" />
        </Field>
        <Field label="비밀번호 확인">
          <input type="password" className={inputCls} value={f.password2} onChange={(e) => setF({ ...f, password2: e.target.value })} required autoComplete="new-password" />
        </Field>
        <ErrorBox error={err} />
        <Button type="submit" loading={busy} className="w-full">
          <ShieldCheck className="h-4 w-4" /> 관리자 계정 만들기
        </Button>
      </form>
    </Shell>
  );
}

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (mode === "forgot") {
    return (
      <Shell title="비밀번호 찾기" sub="아이디 또는 등록된 이메일을 입력하면, 그 이메일로 임시 비밀번호를 보내 드립니다.">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            setMsg(null);
            setBusy(true);
            try {
              const r = await api.send<{ message: string }>("POST", "/auth/forgot", { idOrEmail: id });
              setMsg(r.message);
            } catch (e2) {
              setErr(e2);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="아이디 또는 이메일">
            <input className={inputCls} value={id} onChange={(e) => setId(e.target.value)} required />
          </Field>
          <ErrorBox error={err} />
          {msg && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
          <Button type="submit" loading={busy} className="w-full">
            <Mail className="h-4 w-4" /> 임시 비밀번호 받기
          </Button>
          <button type="button" className="w-full text-sm text-slate-500 hover:text-slate-800" onClick={() => setMode("login")}>
            ← 로그인으로 돌아가기
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell title="로그인">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          setBusy(true);
          try {
            const r = await api.send<{ token: string }>("POST", "/auth/login", { id, password: pw });
            setToken(r.token);
            onLogin();
          } catch (e2) {
            setErr(e2);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="아이디 또는 이메일">
          <input className={inputCls} value={id} onChange={(e) => setId(e.target.value)} required autoComplete="username" autoFocus />
        </Field>
        <Field label="비밀번호">
          <input type="password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="current-password" />
        </Field>
        <ErrorBox error={err} />
        <Button type="submit" loading={busy} className="w-full">
          <LogIn className="h-4 w-4" /> 로그인
        </Button>
        <button type="button" className="w-full text-sm text-slate-500 hover:text-slate-800" onClick={() => setMode("forgot")}>
          비밀번호를 잊으셨나요?
        </button>
      </form>
    </Shell>
  );
}

export function ChangePasswordForm({ forced, onDone }: { forced?: boolean; onDone: () => void }) {
  const [f, setF] = useState({ current: "", next: "", next2: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const form = (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        if (f.next !== f.next2) return setErr("새 비밀번호 확인이 일치하지 않습니다.");
        setBusy(true);
        try {
          await api.send("POST", "/auth/password", { current: f.current, next: f.next });
          setF({ current: "", next: "", next2: "" });
          onDone();
        } catch (e2) {
          setErr(e2);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={forced ? "임시 비밀번호" : "현재 비밀번호"}>
        <input type="password" className={inputCls} value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required autoComplete="current-password" />
      </Field>
      <Field label="새 비밀번호 (8자 이상)">
        <input type="password" className={inputCls} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required autoComplete="new-password" />
      </Field>
      <Field label="새 비밀번호 확인">
        <input type="password" className={inputCls} value={f.next2} onChange={(e) => setF({ ...f, next2: e.target.value })} required autoComplete="new-password" />
      </Field>
      <ErrorBox error={err} />
      <Button type="submit" loading={busy} className={forced ? "w-full" : ""}>
        <KeyRound className="h-4 w-4" /> 비밀번호 변경
      </Button>
    </form>
  );
  if (!forced) return form;
  return (
    <Shell title="새 비밀번호 설정" sub="임시 비밀번호로 로그인하셨습니다. 계속하려면 새 비밀번호로 바꿔 주세요.">
      {form}
    </Shell>
  );
}
