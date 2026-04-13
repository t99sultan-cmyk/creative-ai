"use client";

import { useEffect, useState } from "react";
import { getAdminDashboardData, createPromoCode, updateUserImpulses, getUserHistory } from "@/actions/adminActions";
import { useRouter } from "next/navigation";
import { CopyIcon, CheckCircleIcon, Edit2Icon, HistoryIcon, XIcon, CheckIcon } from "lucide-react";

function UserRow({ u, onRefresh, onViewHistory }: { u: any, onRefresh: () => void, onViewHistory: (userId: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [newBalance, setNewBalance] = useState(u.impulses);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const res = await updateUserImpulses(u.id, parseInt(newBalance));
    if (res.success) {
      setEditing(false);
      onRefresh(); // Refresh parent data
    } else {
      alert("Ошибка: " + res.error);
    }
    setSaving(false);
  };

  return (
    <tr className="hover:bg-neutral-50 transition-colors text-sm">
      <td className="p-4 font-medium text-neutral-800 break-all">{u.email}</td>
      <td className="p-4">
        {editing ? (
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              value={newBalance} 
              onChange={e => setNewBalance(e.target.value)}
              className="w-20 px-2 py-1 border rounded text-xs"
              min="0"
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
                  <span key={p.code} title={p.code} className="bg-orange-50 text-orange-600 px-2 py-1 rounded truncate max-w-[120px] inline-block font-mono">
                     +{p.impulses}⚡
                  </span>
               ))}
            </div>
         ) : (
            <span className="text-neutral-400 italic">Free Only</span>
         )}
      </td>
      <td className="p-4 text-neutral-400 text-xs border-l border-neutral-100 text-center">
         {new Date(u.createdAt).toLocaleDateString("ru-RU", { day: '2-digit', month: '2-digit', year: '2-digit' })}
      </td>
      <td className="p-4 text-right">
        <button 
          onClick={() => onViewHistory(u.id)}
          className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 flex items-center gap-2 transition-colors inline-flex"
        >
          <HistoryIcon className="w-3.5 h-3.5" /> История
        </button>
      </td>
    </tr>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // History Modal State
  const [historyModalUser, setHistoryModalUser] = useState<string | null>(null);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const init = async () => {
    const res = await getAdminDashboardData();
    if (!res.success) {
      setError(res.error || "Доступ запрещен");
    } else {
      setData(res);
    }
    setLoading(false);
  };

  useEffect(() => {
    init();
  }, []);

  const handleGeneratePromo = async (impulses: number) => {
    setGenerating(true);
    const res = await createPromoCode(impulses);
    if (res.success && res.code) {
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

  const handleViewHistory = async (userId: string) => {
    setHistoryModalUser(userId);
    setLoadingHistory(true);
    const res = await getUserHistory(userId);
    if (res.success) {
       setUserHistory(res.history);
    } else {
       alert("Ошибка загрузки истории");
    }
    setLoadingHistory(false);
  };

  if (loading) return <div className="h-screen w-full flex items-center justify-center">Загрузка Админки...</div>;

  if (error) {
    return (
      <div className="h-screen w-full flex items-center flex-col justify-center bg-black/5">
        <div className="bg-red-100 text-red-600 px-6 py-4 rounded-xl font-bold font-mono border border-red-200">
          🔒 ОШИБКА ДОСТУПА: {error}
        </div>
      </div>
    );
  }

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
                      <button 
                        onClick={() => copyToClipboard(promo.code)}
                        className="text-neutral-400 hover:text-orange-500 transition-colors shrink-0 ml-2"
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
          <div className="lg:col-span-9">
            <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden h-full">
              <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                <h2 className="text-xl font-bold">👥 База Пользователей CRM</h2>
                <button onClick={init} className="text-sm text-indigo-600 hover:underline">Обновить</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-100 text-xs text-neutral-400 uppercase">
                      <th className="p-4 font-bold">Email</th>
                      <th className="p-4 font-bold">Импульсы</th>
                      <th className="p-4 font-bold border-l border-neutral-100">Сделал Креативов</th>
                      <th className="p-4 font-bold border-l border-neutral-100">Оценки (👍/👎)</th>
                      <th className="p-4 font-bold border-l border-neutral-100">Оплаты / Пакеты</th>
                      <th className="p-4 font-bold border-l border-neutral-100">Регистрация</th>
                      <th className="p-4 font-bold text-right border-l border-neutral-100">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data?.users?.map((u: any) => (
                      <UserRow key={u.id} u={u} onRefresh={init} onViewHistory={handleViewHistory} />
                    ))}
                  </tbody>
                </table>
              </div>
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
                <p className="text-sm text-neutral-500">ID пользователя: {historyModalUser}</p>
              </div>
              <button 
                onClick={() => setHistoryModalUser(null)}
                className="bg-neutral-200 hover:bg-neutral-300 p-2 rounded-full transition-colors"
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
                <div className="grid grid-cols-1 gap-6">
                  {userHistory.map((item, i) => (
                    <div key={item.id} className="border border-neutral-200 rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row bg-white">
                      
                      {/* Left: Metadata & Prompt */}
                      <div className="p-5 flex-1 space-y-4 border-b md:border-b-0 md:border-r border-neutral-100">
                         <div className="flex flex-wrap gap-2 text-xs font-bold font-mono">
                            <span className="bg-neutral-100 px-2 py-1 rounded">Формат: {item.format}</span>
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded">Стоимость: {item.cost} ⚡</span>
                            <span className="bg-neutral-100 px-2 py-1 rounded">{new Date(item.createdAt).toLocaleString("ru-RU")}</span>
                         </div>
                         
                         <div>
                            <h4 className="text-xs uppercase font-bold text-neutral-400 mb-1">Задание (Промпт)</h4>
                            <p className="text-sm text-neutral-700 bg-neutral-50 p-3 rounded-xl border border-neutral-100 whitespace-pre-wrap leading-relaxed">
                              {item.prompt}
                            </p>
                         </div>
                         {item.feedbackScore !== null && (
                            <div className="text-xs font-bold">
                               Оценка ИИ: {item.feedbackScore === 1 ? '👍 Понравилось' : '👎 Не понравилось'}
                            </div>
                         )}
                      </div>

                      {/* Right: Rendered HTML iframe preview */}
                      <div className="w-full md:w-[350px] bg-neutral-100 flex-shrink-0 flex items-center justify-center p-4">
                        <div className={`shadow-xl bg-white rounded-xl overflow-hidden relative ${item.format === '9:16' ? 'aspect-[9/16] w-[200px]' : 'aspect-square w-[250px]'}`}>
                            <iframe 
                              srcDoc={item.htmlCode} 
                              className="absolute inset-0 w-full h-full border-0 pointer-events-none transform origin-top-left"
                              style={{ width: '400px', height: item.format === '9:16' ? '711px' : '400px', transform: 'scale(0.5)' }}
                            />
                        </div>
                      </div>

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
