import { CheckCircle2, CircleAlert, KeyRound, Mail, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import type { User } from "../../shared/types";
import { Badge, Button, Card, ErrorBox, Field, Spinner, inputCls } from "../components/ui";
import { api } from "../lib/api";
import { utcToKst } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useMe } from "../lib/me";
import { ChangePasswordForm } from "./Auth";

export interface Health {
  needsSetup: boolean;
  g2b: boolean;
  claude: boolean;
  mail: boolean;
  storage: string;
  model: string;
}

interface SettingsInfo {
  g2b: boolean;
  claude: boolean;
  mail: boolean;
  mailFrom: string;
  model: string;
}

export default function SettingsPage() {
  const me = useMe();
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">설정</h1>
      {me?.role === "admin" && <KeysCard />}
      {me?.role === "admin" && <UsersCard />}
      <Card title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> 내 비밀번호 변경</span>}>
        <div className="max-w-md">
          {pwMsg && <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{pwMsg}</p>}
          <ChangePasswordForm onDone={() => setPwMsg("비밀번호를 변경했습니다.")} />
        </div>
      </Card>
    </div>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" />}
      <span>{label}</span>
      <span className={ok ? "text-emerald-700" : "text-amber-700"}>{ok ? "설정됨" : "미설정"}</span>
    </li>
  );
}

function KeysCard() {
  const { data, error, loading, reload } = useAsync(() => api.get<SettingsInfo>("/settings"), []);
  const [f, setF] = useState({ g2bKey: "", anthropicKey: "", resendKey: "", mailFrom: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (loading && !data) return <Spinner />;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy("save");
    try {
      await api.send("PUT", "/settings", { ...f, mailFrom: f.mailFrom || undefined });
      setF({ g2bKey: "", anthropicKey: "", resendKey: "", mailFrom: "" });
      setMsg("저장했습니다.");
      reload();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="연결 키 설정 (관리자)">
      <ErrorBox error={error} />
      {data && (
        <ul className="mb-4 space-y-1.5 text-sm">
          <Status ok={data.g2b} label="나라장터 키 — 공고 검색·상세" />
          <Status ok={data.claude} label={`Claude API 키 — AI 분석·제안서 (${data.model})`} />
          <Status ok={data.mail} label="메일 발송(Resend) — 임시 비밀번호·계정 안내" />
        </ul>
      )}
      <form onSubmit={save} className="space-y-3">
        <Field
          label={`나라장터 키 (공공데이터포털 일반 인증키)${data?.g2b ? " — 바꿀 때만 입력" : ""}`}
          hint="data.go.kr → 마이페이지 → 활용신청 현황 → '조달청_나라장터 입찰공고정보서비스' 의 일반 인증키(Decoding)"
        >
          <input className={inputCls} value={f.g2bKey} onChange={(e) => setF({ ...f, g2bKey: e.target.value })} autoComplete="off" />
        </Field>
        <Field label={`Claude API 키${data?.claude ? " — 바꿀 때만 입력" : ""}`} hint="console.anthropic.com → API Keys 에서 만든 sk-ant- 로 시작하는 키">
          <input className={inputCls} value={f.anthropicKey} onChange={(e) => setF({ ...f, anthropicKey: e.target.value })} placeholder="sk-ant-..." autoComplete="off" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`메일 발송 키 (Resend)${data?.mail ? " — 바꿀 때만 입력" : ""}`} hint="resend.com 가입 → API Keys 에서 만든 re_ 로 시작하는 키">
            <input className={inputCls} value={f.resendKey} onChange={(e) => setF({ ...f, resendKey: e.target.value })} placeholder="re_..." autoComplete="off" />
          </Field>
          <Field label="보내는 주소" hint={`현재: ${data?.mailFrom || "BidCheck <onboarding@resend.dev> (기본)"}`}>
            <input className={inputCls} value={f.mailFrom} onChange={(e) => setF({ ...f, mailFrom: e.target.value })} placeholder="BidCheck <no-reply@회사도메인>" />
          </Field>
        </div>
        <ErrorBox error={err} />
        {msg && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy === "save"}>
            저장
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={busy === "mail"}
            disabled={!data?.mail}
            onClick={async () => {
              setErr(null);
              setMsg(null);
              setBusy("mail");
              try {
                await api.send("POST", "/settings/test-mail");
                setMsg("내 이메일로 테스트 메일을 보냈습니다.");
              } catch (e2) {
                setErr(e2);
              } finally {
                setBusy(null);
              }
            }}
          >
            <Mail className="h-4 w-4" /> 테스트 메일 보내기
          </Button>
        </div>
        <p className="text-xs text-slate-400">
          입력한 키는 서버에만 저장되며 화면에 다시 표시되지 않습니다. Resend 는 자체 도메인을 인증하기 전에는 Resend 가입 이메일로만 보낼 수 있습니다.
        </p>
      </form>
    </Card>
  );
}

function UsersCard() {
  const me = useMe();
  const { data, error, loading, reload } = useAsync(() => api.get<User[]>("/admin/users"), []);
  const [f, setF] = useState({ id: "", name: "", email: "", role: "user", sendEmail: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function act<T>(fn: () => Promise<T>) {
    setErr(null);
    setNotice(null);
    try {
      return await fn();
    } catch (e) {
      setErr(e);
    } finally {
      reload();
    }
  }

  return (
    <Card title="사용자 관리 (관리자)">
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await act(() => api.send<{ tempPassword: string; mailed: boolean }>("POST", "/admin/users", f));
          setBusy(false);
          if (r) {
            setNotice(
              r.mailed
                ? `${f.name}님 계정을 만들고 ${f.email} 로 안내 메일을 보냈습니다.`
                : `${f.name}님 계정을 만들었습니다. 임시 비밀번호: ${r.tempPassword} (직접 전달해 주세요)`,
            );
            setF({ id: "", name: "", email: "", role: "user", sendEmail: true });
          }
        }}
      >
        <Field label="아이디">
          <input className={inputCls} value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} required />
        </Field>
        <Field label="이름">
          <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </Field>
        <Field label="이메일">
          <input type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        </Field>
        <Field label="권한">
          <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="user">일반 사용자</option>
            <option value="admin">관리자</option>
          </select>
        </Field>
        <div className="flex flex-col justify-end gap-1">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={f.sendEmail} onChange={(e) => setF({ ...f, sendEmail: e.target.checked })} /> 임시 비밀번호 메일 발송
          </label>
          <Button type="submit" loading={busy}>
            <UserPlus className="h-4 w-4" /> 등록
          </Button>
        </div>
      </form>
      <ErrorBox error={err || error} />
      {notice && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      {loading && !data ? (
        <Spinner />
      ) : (
        <div className="-mx-4 mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">아이디</th>
                <th className="px-2 py-2">이름</th>
                <th className="px-2 py-2">이메일</th>
                <th className="px-2 py-2">권한</th>
                <th className="px-2 py-2">최근 로그인</th>
                <th className="px-4 py-2 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.map((u) => (
                <tr key={u.id} className={u.active ? "" : "text-slate-400"}>
                  <td className="px-4 py-2 font-medium">
                    {u.id} {!u.active && <Badge className="bg-slate-100 text-slate-500 ring-slate-200">사용중지</Badge>}
                    {u.must_change ? <Badge className="ml-1 bg-amber-50 text-amber-800 ring-amber-200">임시비번</Badge> : null}
                  </td>
                  <td className="px-2 py-2">{u.name}</td>
                  <td className="px-2 py-2">{u.email}</td>
                  <td className="px-2 py-2">
                    <select
                      className={`${inputCls} py-1 text-xs`}
                      value={u.role}
                      disabled={u.id === me?.id}
                      onChange={(e) => act(() => api.send("PATCH", `/admin/users/${u.id}`, { role: e.target.value }))}
                    >
                      <option value="user">일반</option>
                      <option value="admin">관리자</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 text-xs">{u.last_login_at ? utcToKst(u.last_login_at) : "-"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        if (!confirm(`${u.name}님의 비밀번호를 임시 비밀번호로 초기화할까요?`)) return;
                        const r = await act(() => api.send<{ tempPassword: string; mailed: boolean }>("POST", `/admin/users/${u.id}/reset`));
                        if (r)
                          setNotice(
                            r.mailed ? `${u.email} 로 임시 비밀번호를 보냈습니다.` : `메일 발송 불가 — 임시 비밀번호: ${r.tempPassword} (직접 전달해 주세요)`,
                          );
                      }}
                    >
                      비밀번호 초기화
                    </Button>
                    {u.id !== me?.id && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => act(() => api.send("PATCH", `/admin/users/${u.id}`, { active: !u.active }))}
                        >
                          {u.active ? "사용중지" : "다시 사용"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="삭제"
                          onClick={() => confirm(`${u.name}님 계정을 삭제할까요?`) && act(() => api.send("DELETE", `/admin/users/${u.id}`))}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
