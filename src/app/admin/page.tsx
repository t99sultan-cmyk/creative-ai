"use client";

import { useEffect, useState, useMemo } from "react";
import {
  getAdminDashboardData,
  createPromoCode,
  updateUserImpulses,
  getUserHistory,
  deletePromoCode,
  toggleUserBan,
  getAdminStats,
  getAdminAuditLog,
  adminDownloadCreative,
  adminImpersonateUser,
  type UserStatusFilter,
} from "@/actions/adminActions";
import { useRouter } from "next/navigation";
import {
  CopyIcon,
  CheckCircleIcon,
  Edit2Icon,
  HistoryIcon,
  XIcon,
  CheckIcon,
  TrashIcon,
  BanIcon,
  CheckCircle2Icon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UsersIcon,
  ZapIcon,
  DollarSignIcon,
  TrendingUpIcon,
  ShieldAlertIcon,
  ActivityIcon,
  DownloadIcon,
  UserCogIcon,
} from "lucide-react";

function formatKzt(n: number): string {
  if (!Number.isFinite(n)) return "0 ₸";
  return `${Math.round(n).toLocaleString("ru-RU")} ₸`;
}

function UserRow({ u, onRefresh, onViewHistory }: { u: any, onRefresh: () => void, onViewHistory: (userId: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [newBalance, setNewBalance] = useState(u.impulses);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const parsed = parseInt(newBalance, 10);
    if (!Number.isFinite(parsed)) {
      alert("Введите целое число.");
      return;
    }

    // Confirmation — balance changes touch money, one-click edits are too risky.
    // Only ask if the value actually changed.
    const current = u.impulses ?? 0;
    if (parsed !== current) {
      const delta = parsed - current;
      const sign = delta > 0 ? "+" : "";
      const ok = confirm(
        `Изменить баланс пользователя ${u.email}?\n\n` +
        `Было: ${current} импульсов\n` +
        `Станет: ${parsed} импульсов\n` +
        `Разница: ${sign}${delta}\n\n` +
        `Это действие необратимо. Оно будет записано в audit log.`
      );
      if (!ok) return;
    }

    setSaving(true);
    const res = await updateUserImpulses(u.id, parsed);
    if (res.success) {
      setEditing(false);
      onRefresh(); // Refresh parent data
    } else {
      alert("Ошибка: " + res.error);
    }
    setSaving(false);
  };

  const handleToggleBan = async () => {
    // Ban/unban is also destructive — require confirm.
    const action = u.isBanned ? "разбанить" : "забанить";
    const ok = confirm(
      `Точно ${action} пользователя ${u.email}?\n\n` +
      (u.isBanned
        ? `После разбана он снова сможет заходить и генерировать.`
        : `После бана он не сможет заходить в приложение.`) +
      `\n\nДействие будет записано в audit log.`
    );
    if (!ok) return;

    setSaving(true);
    const res = await toggleUserBan(u.id, !u.isBanned);
    if (res.success) {
      onRefresh();
    } else {
      alert("Ошибка бана: " + res.error);
    }
    setSaving(false);
  };

  const handleImpersonate = async () => {
    const ok = confirm(
      `Войти под аккаунтом ${u.email}?\n\n` +
      `Ты увидишь приложение глазами пользователя — его балансом, историей ` +
      `и скачиваниями. Текущая админ-сессия будет заменена.\n\n` +
      `Чтобы вернуться в админку — выйди через UserButton и войди снова как админ.\n\n` +
      `Действие пишется в audit log.`
    );
    if (!ok) return;
    setSaving(true);
    const res = await adminImpersonateUser(u.id);
    if (res.success && res.url) {
      // Remember the impersonation locally so the banner on /editor can
      // show the target email without an extra DB call.
      try {
        sessionStorage.setItem("impersonating_email", res.targetEmail || u.email);
      } catch {}
      window.location.href = res.url;
    } else {
      alert("Не удалось войти: " + res.error);
      setSaving(false);
    }
  };

  return (
    <tr className={`hover:bg-neutral-100 transition-colors text-sm ${u.isBanned ? 'bg-red-50/50 opacity-60 grayscale' : 'bg-white'}`}>
      <td className="p-4 font-medium text-neutral-800 break-all">
         {u.email}
         {u.isBanned && <span className="ml-2 text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">BANNED</span>}
      </td>
      <td className="p-4">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={newBalance}
              onChange={e => setNewBalance(e.target.value)}
              className="w-20 px-2 py-1 border rounded text-xs"
              min="0"
              max="100000"
              step="1"
            />
            <button onClick={handleSave} disabled={saving} className="text-green-600 hover:text-green-700">
              <CheckIcon className="w-4 h-4" />
            </button>
            <button onClick={() => { setEditing(false); setNewBalance(u.impulses); }} className="text-red-500 hover:text-red-600">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
             <span className={`inline-flex items-center justify-center px-2 py-1 rounded-md font-bold text-xs ${u.impulses < 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              {u.impulses} ⚡
            </span>
            <button onClick={() => setEditing(true)} className="text-neutral-400 hover:text-orange-500" title="Изменить баланс">
              <Edit2Icon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </td>
      <td className="p-4 text-neutral-500 text-xs text-center border-l border-neutral-100">
         {u.totalGenerations}
      </td>
      <td className="p-4 border-l border-neutral-100">
         <span className={`font-bold font-mono text-xs ${u.totalApiCostKzt > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
            {u.totalApiCostKzt > 0 ? `${u.totalApiCostKzt.toFixed(2)} ₸` : '0 ₸'}
         </span>
      </td>
      <td className="p-4 border-l border-neutral-100">
         <div className="flex flex-col text-xs font-bold gap-1">
             {u.likes > 0 && <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded w-max">👍 {u.likes}</span>}
             {u.dislikes > 0 && <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded w-max">👎 {u.dislikes}</span>}
             {u.likes === 0 && u.dislikes === 0 && <span className="text-neutral-300 font-normal ml-1">-</span>}
         </div>
      </td>
      <td className="p-4 border-l border-neutral-100 text-xs">
         {u.promosUsed?.length > 0 ? (
            <div className="flex flex-col gap-1">
               {u.promosUsed.map((p: any) => (
                  <div key={p.code} className="flex flex-col mb-1 border-b border-neutral-100 last:border-0 pb-1 last:pb-0">
                    <span title={p.code} className="text-orange-600 font-bold mb-0.5">
                       +{p.impulses}⚡ Пакет
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                       {p.usedAt ? new Date(p.usedAt).toLocaleString("ru-RU", { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Неизвестно'}
                    </span>
                  </div>
               ))}
            </div>
         ) : (
            <span className="text-neutral-400 italic">Free Only</span>
         )}
      </td>
      <td className="p-4 text-xs border-l border-neutral-100 text-center">
         <div className="text-neutral-400">
            {u.createdAt ? new Date(u.createdAt).toLocaleDateString("ru-RU", { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
         </div>
         {u.phone ? (
            <a href={`tel:${u.phone}`} className="mt-1 inline-block font-mono text-neutral-700 hover:text-orange-600 transition-colors">
               {u.phone}
            </a>
         ) : (
            <div className="mt-1 text-neutral-300 italic">нет телефона</div>
         )}
      </td>
      <td className="p-4 text-right">
        <div className="flex flex-col gap-2 items-end">
          <button
            onClick={() => onViewHistory(u.id)}
            className="text-xs w-full justify-center bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 flex items-center transition-colors"
          >
            <HistoryIcon className="w-3.5 h-3.5 mr-1" /> История
          </button>

          <button
            onClick={handleImpersonate}
            disabled={saving || u.isBanned}
            className="text-xs w-full justify-center px-3 py-1.5 rounded-lg font-bold flex items-center transition-colors bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Войти как этот пользователь"
          >
            <UserCogIcon className="w-3.5 h-3.5 mr-1" /> Войти как
          </button>

          <button
            onClick={handleToggleBan}
            disabled={saving}
            className={`text-xs w-full justify-center px-3 py-1.5 rounded-lg font-bold flex items-center transition-colors ${u.isBanned ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
          >
            {u.isBanned ? <><CheckCircle2Icon className="w-3.5 h-3.5 mr-1" /> Разбан</> : <><BanIcon className="w-3.5 h-3.5 mr-1" /> Забанить</>}
          </button>
        </div>
      </td>
    </tr>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: any;
  accent?: "neutral" | "orange" | "green" | "indigo" | "rose";
}) {
  const accentMap: Record<string, string> = {
    neutral: "bg-neutral-50 text-neutral-700",
    orange: "bg-orange-50 text-orange-600",
    green: "bg-green-50 text-green-700",
    indigo: "bg-indigo-50 text-indigo-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">{label}</span>
        {Icon && (
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentMap[accent]}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <div className="text-2xl font-black text-neutral-900 font-mono">{value}</div>
      {sub && <div className="text-[11px] text-neutral-500 leading-snug">{sub}</div>}
    </div>
  );
}

function Sparkline({
  series,
  accessor,
  color,
}: {
  series: { date: string; users: number; gens: number; apiCostKzt: number }[];
  accessor: (d: any) => number;
  color: string;
}) {
  const max = Math.max(1, ...series.map(accessor));
  return (
    <div className="flex items-end gap-0.5 h-14">
      {series.map((d) => {
        const val = accessor(d);
        const h = Math.max(2, (val / max) * 100);
        return (
          <div
            key={d.date}
            className={`flex-1 ${color} rounded-t opacity-80 hover:opacity-100 transition-opacity`}
            style={{ height: `${h}%` }}
            title={`${d.date}: ${val.toLocaleString("ru-RU")}`}
          />
        );
      })}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();

  // Main data
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState("");

  // Promo generation
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // History Modal State
  const [historyModalUser, setHistoryModalUser] = useState<string | null>(null);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historyActiveCount, setHistoryActiveCount] = useState(0);
  const [historyDeletedCount, setHistoryDeletedCount] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);

  // Audit log modal
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Sorting
  const [sortByGenerations, setSortByGenerations] = useState(false);

  // Search / filter / pagination
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Debounce search → query
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchData = async () => {
    setLoading(true);
    const res = await getAdminDashboardData({
      search: searchQuery,
      status: statusFilter,
      page: currentPage,
      pageSize,
    });
    if (!res.success) {
      setError(res.error || "Доступ запрещен");
    } else {
      setData(res);
      setError("");
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    const res = await getAdminStats();
    if (res.success) setStats(res);
  };

  // Refetch on filter / pagination change
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, statusFilter, currentPage]);

  // Stats only once on mount (can also add a refresh button)
  useEffect(() => {
    fetchStats();
  }, []);

  const handleGeneratePromo = async (impulses: number) => {
    setGenerating(true);
    const res = await createPromoCode(impulses);
    if (res.success && res.code) {
      setData((prev: any) => ({
        ...prev,
        activePromos: [{ code: res.code, impulses, isUsed: false, createdAt: new Date() }, ...(prev?.activePromos ?? [])]
      }));
    } else {
      alert("Ошибка: " + res.error);
    }
    setGenerating(false);
  };

  const handleDeletePromo = async (code: string) => {
    if (!confirm("Удалить этот промокод навсегда?")) return;

    // Optimistic UI update
    setData((prev: any) => ({
      ...prev,
      activePromos: prev.activePromos.filter((p: any) => p.code !== code)
    }));

    const res = await deletePromoCode(code);
    if (!res.success) {
      alert("Ошибка удаления: " + res.error);
      fetchData(); // Revert back if failed
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const HISTORY_PAGE_SIZE = 50;

  const handleViewHistory = async (userId: string) => {
    setHistoryModalUser(userId);
    setLoadingHistory(true);
    // Reset paginated state when opening a new user's history.
    setUserHistory([]);
    setHistoryTotalCount(0);
    setHistoryActiveCount(0);
    setHistoryDeletedCount(0);
    setHistoryHasMore(false);
    const res = await getUserHistory(userId, HISTORY_PAGE_SIZE, 0);
    if (res.success) {
       setUserHistory((res.history as any[]) || []);
       setHistoryTotalCount(res.totalCount ?? 0);
       setHistoryActiveCount((res as any).activeCount ?? 0);
       setHistoryDeletedCount((res as any).deletedCount ?? 0);
       setHistoryHasMore(res.hasMore ?? false);
    } else {
       alert("Ошибка загрузки истории");
    }
    setLoadingHistory(false);
  };

  const handleLoadMoreHistory = async () => {
    if (!historyModalUser || historyLoadingMore || !historyHasMore) return;
    setHistoryLoadingMore(true);
    const res = await getUserHistory(historyModalUser, HISTORY_PAGE_SIZE, userHistory.length);
    if (res.success) {
      setUserHistory(prev => [...prev, ...((res.history as any[]) || [])]);
      setHistoryTotalCount(res.totalCount ?? historyTotalCount);
      setHistoryHasMore(res.hasMore ?? false);
    } else {
      alert("Ошибка загрузки следующей страницы");
    }
    setHistoryLoadingMore(false);
  };

  const handleAdminDownload = async (creativeId: string) => {
    const res = await adminDownloadCreative(creativeId);
    if (!res.success) {
      alert("Ошибка скачивания: " + res.error);
      return;
    }
    if (res.kind === "video") {
      // MP4 is public in the GCS bucket — direct link works.
      window.open(res.url, "_blank", "noopener");
      return;
    }
    if (res.kind === "html") {
      // Package the raw HTML source into a client-side blob so admin gets
      // a .html file they can open in a browser.
      const blob = new Blob([res.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      if (res.warning) alert(res.warning);
    }
  };

  const openAuditLog = async () => {
    setAuditOpen(true);
    setLoadingAudit(true);
    const res = await getAdminAuditLog(100);
    if (res.success) {
      setAuditRows(res.rows || []);
    } else {
      alert("Ошибка загрузки аудита");
    }
    setLoadingAudit(false);
  };

  const sortedUsers = useMemo(() => {
    if (!data?.users) return [];
    const arr = [...data.users];
    if (sortByGenerations) {
      arr.sort((a: any, b: any) => b.totalGenerations - a.totalGenerations);
    } else {
      arr.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return arr;
  }, [data?.users, sortByGenerations]);

  if (loading && !data) return <div className="h-screen w-full flex items-center justify-center">Загрузка Админки...</div>;

  if (error) {
    return (
      <div className="h-screen w-full flex items-center flex-col justify-center bg-black/5">
        <div className="bg-red-100 text-red-600 px-6 py-4 rounded-xl font-bold font-mono border border-red-200">
          🔒 ОШИБКА ДОСТУПА: {error}
        </div>
      </div>
    );
  }

  const totalPages = data?.pagination?.totalPages ?? 1;
  const totalCount = data?.pagination?.totalCount ?? 0;
  const pageStart = data?.users?.length ? (currentPage - 1) * pageSize + 1 : 0;
  const pageEnd = data?.users?.length ? pageStart + data.users.length - 1 : 0;

  return (
    <div className="min-h-screen bg-neutral-50 p-6 font-sans relative">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-neutral-200">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-rose-600">
              AICreative Admin Portal (CRM)
            </h1>
            <p className="text-neutral-500">Управление пользователями, промокодами и историей</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openAuditLog}
              className="px-4 py-2 rounded-xl border border-neutral-200 font-medium hover:bg-neutral-100 transition-colors flex items-center gap-2 text-sm"
              title="Журнал действий админов"
            >
              <ShieldAlertIcon className="w-4 h-4" /> Audit log
            </button>
            <button
              onClick={() => { fetchStats(); fetchData(); }}
              className="px-4 py-2 rounded-xl border border-neutral-200 font-medium hover:bg-neutral-100 transition-colors text-sm"
            >
              ↻ Обновить
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 rounded-xl border border-neutral-200 font-medium hover:bg-neutral-100 transition-colors text-sm"
            >
              На сайт
            </button>
          </div>
        </header>

        {/* FINANCIAL DASHBOARD */}
        {stats && (
          <section className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard
                label="Юзеров всего"
                value={stats.users.total}
                sub={`+${stats.users.week} за неделю, +${stats.users.today} сегодня`}
                icon={UsersIcon}
                accent="indigo"
              />
              <StatCard
                label="Активных 7д"
                value={stats.users.active7d}
                sub={`${stats.users.active30d} за 30д, банов: ${stats.users.banned}`}
                icon={ActivityIcon}
                accent="green"
              />
              <StatCard
                label="Генераций сегодня"
                value={stats.generations.today}
                sub={`${stats.generations.week} за неделю, ${stats.generations.total} всего`}
                icon={ZapIcon}
                accent="orange"
              />
              <StatCard
                label="API-расход (30д)"
                value={formatKzt(stats.apiCostsKzt.month)}
                sub={`${stats.apiCostsKzt.perGenAvg.toFixed(1)} ₸ / ген · ${formatKzt(stats.apiCostsKzt.total)} всего`}
                icon={DollarSignIcon}
                accent="rose"
              />
              <StatCard
                label="Доход (оценка, 30д)"
                value={formatKzt(stats.revenueKztEstimate.month)}
                sub={`Платящих: ${stats.users.paying} · Всего: ${formatKzt(stats.revenueKztEstimate.total)}`}
                icon={TrendingUpIcon}
                accent="green"
              />
              <StatCard
                label="ARPU"
                value={formatKzt(stats.revenueKztEstimate.arpu)}
                sub={`~${stats.revenueKztEstimate.avgKztPerImpulse} ₸ за 1 ⚡ (средняя)`}
                icon={TrendingUpIcon}
                accent="indigo"
              />
            </div>

            {/* Revenue disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-900">
              <strong>⚠️ Доход — оценка:</strong> {stats.revenueKztEstimate.disclaimer}
            </div>

            {/* 14-day sparklines + Top users */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-neutral-700">Новых юзеров (14д)</h3>
                  <span className="text-xs text-neutral-400">макс: {Math.max(0, ...stats.dailySeries.map((d: any) => d.users))}</span>
                </div>
                <Sparkline series={stats.dailySeries} accessor={(d: any) => d.users} color="bg-indigo-400" />
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-neutral-700">Генераций в день (14д)</h3>
                  <span className="text-xs text-neutral-400">макс: {Math.max(0, ...stats.dailySeries.map((d: any) => d.gens))}</span>
                </div>
                <Sparkline series={stats.dailySeries} accessor={(d: any) => d.gens} color="bg-orange-400" />
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-neutral-700">API-расход в день (14д)</h3>
                  <span className="text-xs text-neutral-400">макс: {formatKzt(Math.max(0, ...stats.dailySeries.map((d: any) => d.apiCostKzt)))}</span>
                </div>
                <Sparkline series={stats.dailySeries} accessor={(d: any) => d.apiCostKzt} color="bg-rose-400" />
              </div>
            </div>

            {/* Top users */}
            {stats.topUsers?.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4">
                <h3 className="text-sm font-bold text-neutral-700 mb-3">🏆 Топ-10 по генерациям</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-neutral-400 uppercase border-b border-neutral-100">
                        <th className="text-left pb-2 font-bold">#</th>
                        <th className="text-left pb-2 font-bold">Email</th>
                        <th className="text-right pb-2 font-bold">Ген.</th>
                        <th className="text-right pb-2 font-bold">API-расход</th>
                        <th className="text-right pb-2 font-bold">Баланс</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topUsers.map((u: any, i: number) => (
                        <tr key={u.id} className="border-b border-neutral-50 last:border-0">
                          <td className="py-2 text-neutral-400 font-mono">{i + 1}</td>
                          <td className="py-2 font-medium text-neutral-800 break-all">{u.email}</td>
                          <td className="py-2 text-right font-bold">{u.gens}</td>
                          <td className="py-2 text-right font-mono text-rose-500">{formatKzt(u.apiCostKzt)}</td>
                          <td className="py-2 text-right font-bold text-orange-600">{u.impulses} ⚡</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT: PROMO CODES */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-200">
              <h2 className="text-xl font-bold mb-4">🏭 Локали & Пакеты</h2>

              <div className="space-y-3">
                <button
                  disabled={generating}
                  onClick={() => handleGeneratePromo(45)}
                  className="w-full flex justify-between items-center bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold px-4 py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  <span>"Креатор"</span>
                  <span>45 ⚡</span>
                </button>
                <button
                  disabled={generating}
                  onClick={() => handleGeneratePromo(126)}
                  className="w-full flex justify-between items-center bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-4 py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  <span>"Бизнес"</span>
                  <span>126 ⚡</span>
                </button>
                <button
                  disabled={generating}
                  onClick={() => handleGeneratePromo(453)}
                  className="w-full flex justify-between items-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-4 py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  <span>"Студия"</span>
                  <span>453 ⚡</span>
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
              <h2 className="text-lg font-bold mb-4">🎟 Активные Коды</h2>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                {data?.activePromos?.length === 0 && <p className="text-sm text-neutral-400 text-center py-4">Все активированы</p>}
                {data?.activePromos?.map((promo: any) => (
                  <div key={promo.code} className="flex flex-col bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono font-bold text-[10px] bg-white px-2 py-1 rounded shadow-sm break-all">{promo.code}</span>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => copyToClipboard(promo.code)}
                          className="text-neutral-400 hover:text-orange-500 transition-colors p-1"
                        >
                          {copiedCode === promo.code ? <CheckCircleIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeletePromo(promo.code)}
                          className="text-neutral-400 hover:text-red-500 transition-colors p-1"
                          title="Удалить код"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-neutral-500">Баланс: {promo.impulses} ⚡</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: USER DB */}
          <div className="lg:col-span-9">
            <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden h-full">
              <div className="p-6 border-b border-neutral-100 flex flex-col gap-4">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h2 className="text-xl font-bold">
                    👥 База Пользователей CRM
                    <span className="ml-2 text-sm font-mono text-neutral-400 font-normal">({totalCount})</span>
                  </h2>
                </div>

                {/* Search + filters */}
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="search"
                      placeholder="Поиск по email…"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 p-1 bg-neutral-100 rounded-xl">
                    {([
                      { key: "all", label: "Все" },
                      { key: "active", label: "Активные" },
                      { key: "banned", label: "Баны" },
                      { key: "low_balance", label: "<10 ⚡" },
                    ] as { key: UserStatusFilter; label: string }[]).map((f) => (
                      <button
                        key={f.key}
                        onClick={() => { setStatusFilter(f.key); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          statusFilter === f.key
                            ? "bg-white shadow text-neutral-900"
                            : "text-neutral-500 hover:text-neutral-800"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-100 text-xs text-neutral-400 uppercase">
                      <th className="p-4 font-bold">Email</th>
                      <th className="p-4 font-bold">Импульсы</th>
                      <th
                        className="p-4 font-bold border-l border-neutral-100 cursor-pointer hover:bg-neutral-100 select-none"
                        onClick={() => setSortByGenerations(!sortByGenerations)}
                        title="Нажмите для сортировки по наибольшему числу генераций"
                      >
                        <span className="flex items-center gap-1">
                          Сделал Креативов {sortByGenerations ? '⬇️' : ''}
                        </span>
                      </th>
                      <th className="p-4 font-bold border-l border-neutral-100">Расход API ₸</th>
                      <th className="p-4 font-bold border-l border-neutral-100">Оценки (👍/👎)</th>
                      <th className="p-4 font-bold border-l border-neutral-100">Оплаты / Пакеты</th>
                      <th className="p-4 font-bold border-l border-neutral-100">Регистрация</th>
                      <th className="p-4 font-bold text-right border-l border-neutral-100">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {sortedUsers.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-neutral-400">
                          {searchQuery || statusFilter !== "all"
                            ? "Ничего не найдено. Поменяй фильтры."
                            : "Нет пользователей."}
                        </td>
                      </tr>
                    )}
                    {sortedUsers.map((u: any) => (
                      <UserRow key={u.id} u={u} onRefresh={fetchData} onViewHistory={handleViewHistory} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-neutral-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-neutral-50">
                  <span className="text-xs text-neutral-500">
                    {pageStart > 0
                      ? `Показано ${pageStart}–${pageEnd} из ${totalCount}`
                      : `0 из ${totalCount}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || loading}
                      className="p-2 rounded-lg border border-neutral-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Предыдущая страница"
                    >
                      <ChevronLeftIcon className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono text-neutral-600 min-w-[60px] text-center">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || loading}
                      className="p-2 rounded-lg border border-neutral-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Следующая страница"
                    >
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* HISTORY MODAL */}
      {historyModalUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50">
              <div>
                <h2 className="text-xl font-bold">История Креативов</h2>
                <p className="text-sm text-neutral-500">
                  ID: {historyModalUser}
                  {historyTotalCount > 0 && (
                    <span className="ml-2 bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full font-mono text-xs">
                      показано {userHistory.length} / {historyTotalCount}
                    </span>
                  )}
                </p>
                {historyTotalCount > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                      ✓ Активно: {historyActiveCount}
                    </span>
                    {historyDeletedCount > 0 && (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                        🗑 Удалено: {historyDeletedCount}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setHistoryModalUser(null)}
                className="bg-neutral-200 hover:bg-neutral-300 p-2 rounded-full transition-colors"
                aria-label="Закрыть"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-full text-neutral-500">Загрузка данных...</div>
              ) : userHistory.length === 0 ? (
                <div className="flex items-center justify-center h-full text-neutral-500 text-lg">Пользователь еще ничего не генерировал.</div>
              ) : (
                <div className="grid grid-cols-1 gap-6 pb-4">
                  {userHistory.map((item) => (
                    <div
                      key={item.id}
                      className={`border rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row transition-colors ${
                        item.deletedAt
                          ? 'border-red-200 bg-red-50/40'
                          : 'border-neutral-200 bg-white'
                      }`}
                    >

                      {/* Left: Metadata & Prompt */}
                      <div className="p-5 flex-1 space-y-4 border-b md:border-b-0 md:border-r border-neutral-100">
                         <div className="flex flex-wrap gap-2 text-xs font-bold font-mono items-center">
                            {item.deletedAt && (
                              <span className="bg-red-600 text-white px-2 py-1 rounded uppercase tracking-wider font-bold">
                                🗑 Удалено пользователем
                              </span>
                            )}
                            <span className="bg-neutral-100 px-2 py-1 rounded">Формат: {item.format}</span>
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded">Токены: {item.cost} ⚡</span>
                            {item.apiCostKzt > 0 && (
                               <span className="bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100">
                                  Расход: {item.apiCostKzt.toFixed(2)} ₸
                               </span>
                            )}
                            <span className="bg-neutral-100 px-2 py-1 rounded">{new Date(item.createdAt).toLocaleString("ru-RU")}</span>
                            {item.deletedAt && (
                              <span className="bg-red-100 text-red-700 px-2 py-1 rounded">
                                Удалено: {new Date(item.deletedAt).toLocaleString("ru-RU")}
                              </span>
                            )}
                         </div>

                         <div>
                            <h4 className="text-xs uppercase font-bold text-neutral-400 mb-1">Задание (Промпт)</h4>
                            <p className="text-sm text-neutral-700 bg-white p-3 rounded-xl border border-neutral-100 whitespace-pre-wrap leading-relaxed">
                              {item.prompt}
                            </p>
                         </div>
                         {item.feedbackScore !== null && item.feedbackScore !== undefined && (
                            <div className="text-xs font-bold">
                               Оценка ИИ: {item.feedbackScore === 1 ? '👍 Понравилось' : '👎 Не понравилось'}
                            </div>
                         )}

                         {/* Admin action — download the creative (video if
                             rendered, else source HTML). Audit-logged. */}
                         <div className="pt-1">
                           <button
                             onClick={() => handleAdminDownload(item.id)}
                             className="inline-flex items-center gap-2 text-xs font-bold bg-neutral-900 text-white px-3 py-2 rounded-lg hover:bg-neutral-800 active:scale-95 transition-all"
                           >
                             <DownloadIcon className="w-4 h-4" />
                             Скачать
                           </button>
                         </div>
                      </div>

                      {/* Right: Rendered HTML iframe preview */}
                      <div className="w-full md:w-[350px] bg-neutral-100 flex-shrink-0 flex items-center justify-center p-4">
                        <div className={`shadow-xl bg-white rounded-xl overflow-hidden relative ${item.format === '9:16' ? 'aspect-[9/16] w-[200px]' : 'aspect-square w-[250px]'}`}>
                            <iframe
                              srcDoc={item.htmlCode}
                              sandbox="allow-scripts"
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              title={`Creative preview ${item.id}`}
                              className="absolute inset-0 w-full h-full border-0 pointer-events-none transform origin-top-left"
                              style={{ width: '400px', height: item.format === '9:16' ? '711px' : '400px', transform: 'scale(0.5)' }}
                            />
                        </div>
                      </div>

                    </div>
                  ))}

                  {/* Pagination: load next page on demand. Each iframe in the
                      list is expensive, so we never load everything at once. */}
                  {historyHasMore && (
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={handleLoadMoreHistory}
                        disabled={historyLoadingMore}
                        className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold text-sm hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {historyLoadingMore
                          ? "Загрузка…"
                          : `Показать ещё (${historyTotalCount - userHistory.length})`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AUDIT LOG MODAL */}
      {auditOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShieldAlertIcon className="w-5 h-5 text-orange-500" />
                  Audit log — последние 100 действий
                </h2>
                <p className="text-sm text-neutral-500">Все мутации баланса, банов и промокодов.</p>
              </div>
              <button
                onClick={() => setAuditOpen(false)}
                className="bg-neutral-200 hover:bg-neutral-300 p-2 rounded-full transition-colors"
                aria-label="Закрыть"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingAudit ? (
                <div className="text-center text-neutral-500 py-8">Загрузка…</div>
              ) : auditRows.length === 0 ? (
                <div className="text-center text-neutral-500 py-8">Записей нет. Когда начнёшь менять балансы или банить юзеров — они появятся здесь.</div>
              ) : (
                <div className="space-y-2 font-mono text-xs">
                  {auditRows.map((r: any) => (
                    <div key={r.id} className="border border-neutral-100 rounded-lg p-3 flex flex-col gap-1 bg-neutral-50">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-neutral-800">
                          <span className="text-orange-600">{r.action}</span>
                          {r.targetType && <span className="text-neutral-500"> · {r.targetType} </span>}
                          {r.targetId && <span className="text-indigo-600 break-all">{r.targetId}</span>}
                        </span>
                        <span className="text-neutral-400 shrink-0 ml-2">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString("ru-RU") : ''}
                        </span>
                      </div>
                      <div className="text-neutral-600">
                        <span className="text-neutral-400">admin:</span> {r.adminEmail}
                      </div>
                      {r.meta && Object.keys(r.meta).length > 0 && (
                        <pre className="text-[10px] bg-white rounded p-2 mt-1 border border-neutral-200 overflow-x-auto">{JSON.stringify(r.meta, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
