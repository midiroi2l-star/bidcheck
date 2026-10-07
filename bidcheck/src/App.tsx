import clsx from "clsx";
import { Building2, FileSearch, History, LayoutDashboard, ListChecks, Lock, Menu, Settings as SettingsIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { Button, inputCls } from "./components/ui";
import { setPassword } from "./lib/api";
import BidDetail from "./pages/BidDetail";
import Bids from "./pages/Bids";
import Company from "./pages/Company";
import Dashboard from "./pages/Dashboard";
import HistoryPage from "./pages/History";
import Search from "./pages/Search";
import SettingsPage, { SetupScreen, type Health } from "./pages/Settings";
import { api } from "./lib/api";

const NAV = [
  { to: "/", label: "대시보드", icon: LayoutDashboard, end: true },
  { to: "/search", label: "공고 검색", icon: FileSearch },
  { to: "/bids", label: "관심·진행 입찰", icon: ListChecks },
  { to: "/company", label: "회사 정보·서류", icon: Building2 },
  { to: "/history", label: "히스토리", icon: History },
  { to: "/settings", label: "설정", icon: SettingsIcon },
];

export default function App() {
  const [needLogin, setNeedLogin] = useState(false);
  const [menu, setMenu] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    const h = () => setNeedLogin(true);
    window.addEventListener("bidcheck:unauthorized", h);
    api
      .get<Health>("/health")
      .then((r) => setNeedsSetup(r.needsSetup))
      .catch(() => setNeedsSetup(false));
    return () => window.removeEventListener("bidcheck:unauthorized", h);
  }, []);

  if (needsSetup === null) return null;
  if (needsSetup) return <SetupScreen />;

  return (
    <div className="min-h-screen md:flex">
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-30 w-56 bg-brand-900 text-slate-200 transition-transform md:static md:translate-x-0",
          menu ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <div className="text-lg font-bold text-white">BidCheck</div>
            <div className="text-xs text-slate-400">나라장터 입찰 분석</div>
          </div>
          <button className="md:hidden" onClick={() => setMenu(false)} aria-label="메뉴 닫기">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-0.5 px-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMenu(false)}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                  isActive ? "bg-white/10 font-semibold text-white" : "hover:bg-white/5",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {menu && <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setMenu(false)} />}

      <main className="min-w-0 flex-1">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button onClick={() => setMenu(true)} aria-label="메뉴 열기">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-brand-700">BidCheck</span>
        </div>
        <div className="mx-auto max-w-7xl p-4 md:p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/search" element={<Search />} />
            <Route path="/bids" element={<Bids />} />
            <Route path="/bids/:id" element={<BidDetail />} />
            <Route path="/company" element={<Company />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<p className="text-slate-500">페이지를 찾을 수 없습니다.</p>} />
          </Routes>
        </div>
      </main>

      {needLogin && <LoginModal onDone={() => location.reload()} />}
    </div>
  );
}

function LoginModal({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          setPassword(pw);
          onDone();
        }}
      >
        <div className="mb-4 flex items-center gap-2 font-semibold">
          <Lock className="h-4 w-4" /> 접속 비밀번호
        </div>
        <input type="password" autoFocus className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button className="mt-4 w-full" type="submit">
          확인
        </Button>
      </form>
    </div>
  );
}
