import clsx from "clsx";
import {
  Building2,
  CalendarDays,
  FileSearch,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import type { User } from "../shared/types";
import { api, getToken, setToken } from "./lib/api";
import { MeContext } from "./lib/me";
import { ChangePasswordForm, LoginScreen, SetupScreen } from "./pages/Auth";
import Bids from "./pages/Bids";
import Company from "./pages/Company";
import Dashboard from "./pages/Dashboard";
import HistoryPage from "./pages/History";
import NoticeDetail from "./pages/NoticeDetail";
import Search from "./pages/Search";
import type { Health } from "./pages/Settings";

// 차트·다이어그램 라이브러리가 큰 화면은 필요할 때 불러온다
const BidDetail = lazy(() => import("./pages/BidDetail"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const SettingsPage = lazy(() => import("./pages/Settings"));

const NAV = [
  { to: "/", label: "대시보드", icon: LayoutDashboard, end: true },
  { to: "/search", label: "공고 검색", icon: FileSearch },
  { to: "/bids", label: "입찰 관리", icon: ListChecks },
  { to: "/calendar", label: "일정", icon: CalendarDays },
  { to: "/company", label: "회사 정보·서류", icon: Building2 },
  { to: "/history", label: "히스토리", icon: History },
  { to: "/settings", label: "설정", icon: SettingsIcon },
];

type Gate = "loading" | "setup" | "login" | "mustChange" | "ready";

export default function App() {
  const [gate, setGate] = useState<Gate>("loading");
  const [me, setMe] = useState<User | null>(null);
  const [menu, setMenu] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const h = await api.get<Health>("/health");
      if (h.needsSetup) return setGate("setup");
      if (!getToken()) return setGate("login");
      const u = await api.get<User>("/auth/me");
      setMe(u);
      setGate(u.must_change ? "mustChange" : "ready");
    } catch {
      setGate("login");
    }
  }, []);

  useEffect(() => {
    loadMe();
    const onUnauth = () => {
      setToken("");
      setGate("login");
    };
    const onMust = () => setGate("mustChange");
    window.addEventListener("bidcheck:unauthorized", onUnauth);
    window.addEventListener("bidcheck:mustchange", onMust);
    return () => {
      window.removeEventListener("bidcheck:unauthorized", onUnauth);
      window.removeEventListener("bidcheck:mustchange", onMust);
    };
  }, [loadMe]);

  if (gate === "loading") return null;
  if (gate === "setup") return <SetupScreen />;
  if (gate === "login") return <LoginScreen onLogin={loadMe} />;
  if (gate === "mustChange") return <ChangePasswordForm forced onDone={loadMe} />;

  async function logout() {
    await api.send("POST", "/auth/logout").catch(() => {});
    setToken("");
    setGate("login");
  }

  return (
    <MeContext.Provider value={me}>
      <div className="min-h-screen md:flex">
        <aside
          className={clsx(
            "fixed inset-y-0 left-0 z-30 flex w-56 flex-col bg-brand-900 text-slate-200 transition-transform print:hidden md:static md:translate-x-0",
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
          <nav className="flex-1 space-y-0.5 px-2">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMenu(false)}
                className={({ isActive }) =>
                  clsx("flex items-center gap-2.5 rounded-md px-3 py-2 text-sm", isActive ? "bg-white/10 font-semibold text-white" : "hover:bg-white/5")
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-white/10 px-4 py-3 text-sm">
            <div className="font-medium text-white">{me?.name}</div>
            <div className="text-xs text-slate-400">
              {me?.id} · {me?.role === "admin" ? "관리자" : "사용자"}
            </div>
            <button onClick={logout} className="mt-2 inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white">
              <LogOut className="h-3.5 w-3.5" /> 로그아웃
            </button>
          </div>
        </aside>
        {menu && <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setMenu(false)} />}

        <main className="min-w-0 flex-1">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 print:hidden md:hidden">
            <button onClick={() => setMenu(true)} aria-label="메뉴 열기">
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-bold text-brand-700">BidCheck</span>
          </div>
          <div className="mx-auto max-w-7xl p-4 md:p-6 print:max-w-none print:p-0">
            <Suspense fallback={<div className="py-8 text-sm text-slate-500">불러오는 중…</div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/search" element={<Search />} />
              <Route path="/notices/:id" element={<NoticeDetail />} />
              <Route path="/bids" element={<Bids />} />
              <Route path="/bids/:id" element={<BidDetail />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/company" element={<Company />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<p className="text-slate-500">페이지를 찾을 수 없습니다.</p>} />
            </Routes>
            </Suspense>
          </div>
        </main>
      </div>
    </MeContext.Provider>
  );
}
