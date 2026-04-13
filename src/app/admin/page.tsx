"use client";

import { useEffect, useState } from "react";
import { getAdminDashboardData, createPromoCode } from "@/actions/adminActions";
import { useRouter } from "next/navigation";
import { CopyIcon, CheckCircleIcon } from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const res = await getAdminDashboardData();
      if (!res.success) {
        setError(res.error || "Доступ запрещен");
      } else {
        setData(res);
      }
      setLoading(false);
    }
    init();
  }, []);

  const handleGeneratePromo = async (impulses: number) => {
    setGenerating(true);
    const res = await createPromoCode(impulses);
    if (res.success && res.code) {
      // Add to local state so we see it instantly
      setData((prev: any) => ({
        ...prev,
        activePromos: [{ code: res.code, impulses, isUsed: false, createdAt: new Date() }, ...prev.activePromos]
      }));
    } else {
      alert("Ошибка: " + res.error);
    }
    setGenerating(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) return <div className="h-screen w-full flex items-center justify-center">Загрузка Админки...</div>;

  if (error) {
    return (
      <div className="h-screen w-full flex items-center flex-col justify-center bg-black/5">
        <div className="bg-red-100 text-red-600 px-6 py-4 rounded-xl font-bold font-mono border border-red-200">
          🔒 ОШИБКА ДОСТУПА: {error}
        </div>
        <p className="mt-4 text-sm text-neutral-500 max-w-sm text-center">
          Чтобы зайти сюда, ваш Email должен быть прописан в переменной ADMIN_EMAILS в настройках Vercel.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* HEADER */}
        <header className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-neutral-200">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-rose-600">
              AICreative Admin Portal
            </h1>
            <p className="text-neutral-500">Управление пользователями и промокодами</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-neutral-100 px-4 py-2 rounded-xl text-center">
              <div className="text-xs font-bold text-neutral-400 uppercase">Всего Юзеров</div>
              <div className="text-xl font-black">{data?.stats?.totalUsers || 0}</div>
            </div>
            <div className="bg-neutral-100 px-4 py-2 rounded-xl text-center">
              <div className="text-xs font-bold text-neutral-400 uppercase">Генераций</div>
              <div className="text-xl font-black">{data?.stats?.totalGenerations || 0}</div>
            </div>
            <button 
              onClick={() => router.push('/')}
              className="px-4 py-2 rounded-xl border border-neutral-200 font-medium hover:bg-neutral-100 transition-colors"
            >
              На сайт
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: PROMO CODES */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-200">
              <h2 className="text-xl font-bold mb-4">🏭 Фабрика Промокодов</h2>
              <p className="text-sm text-neutral-500 mb-6">Создайте код, скопируйте его и отправьте клиенту после оплаты на Kaspi.</p>
              
              <div className="space-y-3">
                <button 
                  disabled={generating}
                  onClick={() => handleGeneratePromo(45)}
                  className="w-full flex justify-between items-center bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold px-4 py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  <span>Пакет "Креатор"</span>
                  <span>45 ⚡</span>
                </button>
                <button 
                  disabled={generating}
                  onClick={() => handleGeneratePromo(126)}
                  className="w-full flex justify-between items-center bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-4 py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  <span>Пакет "Бизнес"</span>
                  <span>126 ⚡</span>
                </button>
                <button 
                  disabled={generating}
                  onClick={() => handleGeneratePromo(453)}
                  className="w-full flex justify-between items-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-4 py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  <span>Пакет "Студия"</span>
                  <span>453 ⚡</span>
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
              <h2 className="text-xl font-bold mb-4">🎟 Неиспользованные Коды</h2>
              <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                {data?.activePromos?.length === 0 && <p className="text-sm text-neutral-400 text-center py-4">Все активированы</p>}
                {data?.activePromos?.map((promo: any) => (
                  <div key={promo.code} className="flex flex-col bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono font-bold text-sm bg-white px-2 py-1 rounded shadow-sm">{promo.code}</span>
                      <button 
                        onClick={() => copyToClipboard(promo.code)}
                        className="text-neutral-400 hover:text-orange-500 transition-colors"
                      >
                        {copiedCode === promo.code ? <CheckCircleIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="text-xs text-neutral-500">Баланс: {promo.impulses} ⚡</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: USER DB */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
              <div className="p-6 border-b border-neutral-100">
                <h2 className="text-xl font-bold">👥 База Пользователей</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-100 text-sm string text-neutral-400 uppercase">
                      <th className="p-4 font-bold">Email</th>
                      <th className="p-4 font-bold">Импульсы</th>
                      <th className="p-4 font-bold">Зарегистрирован</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data?.users?.map((u: any) => (
                      <tr key={u.id} className="hover:bg-neutral-50 transition-colors text-sm">
                        <td className="p-4 font-medium text-neutral-800">{u.email}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center justify-center px-2 py-1 rounded-md font-bold text-xs ${u.impulses < 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {u.impulses} ⚡
                          </span>
                        </td>
                        <td className="p-4 text-neutral-500">
                           {new Date(u.createdAt).toLocaleDateString("ru-RU", { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
