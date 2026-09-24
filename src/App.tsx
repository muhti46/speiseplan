import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ShoppingCart, Archive, Sparkles, FileDown } from 'lucide-react';
import recipesData from './data/recipes.json';
import { Recipe } from './types/recipe';
import { DayOfWeek, ShoppingItem, WeeklyPlan } from './types/menu';
import { calculateCalendarWeek, generateWeeklyPlan, rerollDay } from './services/generator';
import { buildShoppingLists } from './services/shopping';
import { exportWeeklyPlanPdf } from './services/pdf';
import { getAllPlans, getRecentRecipeIds, savePlan } from './services/storage';
import Tabs, { TabItem } from './components/Tabs';
import DayMenuCard from './components/DayMenuCard';
import CheckboxList from './components/CheckboxList';

const recipes = recipesData as Recipe[];

const TABS: TabItem[] = [
  { id: 'plan', label: 'Speiseplan', icon: CalendarDays },
  { id: 'einkauf', label: 'Einkauf', icon: ShoppingCart },
  { id: 'archiv', label: 'Archiv', icon: Archive },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('plan');
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [archive, setArchive] = useState<WeeklyPlan[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    getAllPlans().then(setArchive);
  }, []);

  const now = useMemo(() => new Date(), []);
  const currentWeek = calculateCalendarWeek(now);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const recentRecipeIds = await getRecentRecipeIds(4);
      const newPlan = generateWeeklyPlan(recipes, {
        calendarWeek: currentWeek,
        year: now.getFullYear(),
        recentRecipeIds,
      });
      const { shoppingListMon, shoppingListFri } = buildShoppingLists(newPlan);
      setPlan({ ...newPlan, shoppingListMon, shoppingListFri });
    } finally {
      setIsGenerating(false);
    }
  }

  function handleReroll(dayOfWeek: DayOfWeek) {
    if (!plan) return;
    const updated = rerollDay(recipes, plan, dayOfWeek);
    const { shoppingListMon, shoppingListFri } = buildShoppingLists(updated);
    setPlan({ ...updated, shoppingListMon, shoppingListFri });
  }

  async function handleFinalize() {
    if (!plan) return;
    const finalized: WeeklyPlan = { ...plan, isFinalized: true };
    await savePlan(finalized);
    setPlan(finalized);
    setArchive(await getAllPlans());
  }

  function toggleItem(list: 'shoppingListMon' | 'shoppingListFri', item: ShoppingItem) {
    if (!plan) return;
    const updatedList = plan[list].map((i) =>
      i.item === item.item && i.unit === item.unit ? { ...i, checked: !i.checked } : i,
    );
    const updatedPlan = { ...plan, [list]: updatedList };
    setPlan(updatedPlan);
    if (plan.isFinalized) {
      savePlan(updatedPlan);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col pb-20 sm:pb-6">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-slate-800">Kinderheim Speiseplan</h1>
        <p className="text-xs text-slate-500">Weilburg · 10–12 Personen</p>
        <div className="mt-3 hidden sm:block">
          <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </header>

      <main className="flex-1 space-y-4 p-4">
        {activeTab === 'plan' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-700">
                {plan ? `KW ${plan.calendarWeek} / ${plan.year}` : `Nächste Woche: KW ${currentWeek + 1}`}
              </h2>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-white active:scale-95 disabled:opacity-60"
              >
                <Sparkles size={16} />
                {plan ? 'Neu generieren' : 'Wochenplan erzeugen'}
              </button>
            </div>

            {!plan && (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
                Noch kein Wochenplan. Mit einem Klick automatisch nach der 5-Tage-Protein-Regel erzeugen.
              </div>
            )}

            {plan &&
              plan.days.map((day) => (
                <DayMenuCard key={day.dayOfWeek} day={day} onReroll={() => handleReroll(day.dayOfWeek)} />
              ))}

            {plan && (
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={plan.isFinalized}
                  className="flex-1 rounded-full border border-brand-700 px-4 py-2 text-sm font-medium text-brand-700 disabled:opacity-50"
                >
                  {plan.isFinalized ? 'Freigegeben & gespeichert' : 'Plan freigeben & speichern'}
                </button>
                <button
                  type="button"
                  onClick={() => exportWeeklyPlanPdf(plan)}
                  className="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
                >
                  <FileDown size={16} />
                  PDF
                </button>
              </div>
            )}
          </section>
        )}

        {activeTab === 'einkauf' && plan && (
          <section className="space-y-8">
            <CheckboxList
              title="Einkauf Montag (Mo–Mi)"
              items={plan.shoppingListMon}
              onToggle={(item) => toggleItem('shoppingListMon', item)}
            />
            <CheckboxList
              title="Einkauf Freitag (Do–Fr)"
              items={plan.shoppingListFri}
              onToggle={(item) => toggleItem('shoppingListFri', item)}
            />
          </section>
        )}
        {activeTab === 'einkauf' && !plan && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            Erzeuge zuerst einen Wochenplan im Tab „Speiseplan“.
          </div>
        )}

        {activeTab === 'archiv' && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-700">Archivierte Wochenpläne</h2>
            {archive.length === 0 && (
              <p className="text-sm text-slate-400">Noch keine freigegebenen Pläne gespeichert.</p>
            )}
            <ul className="space-y-2">
              {archive.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <span>
                    KW {p.calendarWeek} / {p.year}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString('de-DE')}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <div className="sm:hidden">
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      </div>
    </div>
  );
}
