import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ShoppingCart, Archive, Sparkles, FileDown, Languages, MessageCircle } from 'lucide-react';
import recipesData from './data/recipes.json';
import { Recipe } from './types/recipe';
import { DayOfWeek, ShoppingItem, WeeklyPlan } from './types/menu';
import { calculateCalendarWeek, generateWeeklyPlan, rerollDay } from './services/generator';
import { buildShoppingLists } from './services/shopping';
import { exportWeeklyPlanPdf } from './services/pdf';
import { getAllPlans, getAllRecipes, getRecentRecipeIds, saveRecipe, savePlan } from './services/storage';
import Tabs, { TabItem } from './components/Tabs';
import DayMenuCard from './components/DayMenuCard';
import CheckboxList from './components/CheckboxList';
import RecipeDetailModal from './components/RecipeDetailModal';
import ChatPanel from './components/ChatPanel';
import { useLanguage } from './i18n/LanguageContext';
import { LANGUAGES, Lang } from './i18n/translations';

export default function App() {
  const { lang, setLang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('plan');
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [archive, setArchive] = useState<WeeklyPlan[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>(recipesData as Recipe[]);
  const [recentRecipeIds, setRecentRecipeIds] = useState<string[]>([]);

  const TABS: TabItem[] = [
    { id: 'plan', label: t.tabs.plan, icon: CalendarDays },
    { id: 'einkauf', label: t.tabs.einkauf, icon: ShoppingCart },
    { id: 'archiv', label: t.tabs.archiv, icon: Archive },
    { id: 'chat', label: t.tabs.chat, icon: MessageCircle },
  ];

  function toggleLang() {
    const langs = Object.keys(LANGUAGES) as Lang[];
    const next = langs[(langs.indexOf(lang) + 1) % langs.length];
    setLang(next);
  }

  useEffect(() => {
    getAllPlans().then(setArchive);
    getAllRecipes().then((stored) => {
      if (stored.length > 0) setRecipes(stored);
    });
    getRecentRecipeIds(4).then(setRecentRecipeIds);
  }, []);

  const now = useMemo(() => new Date(), []);
  const currentWeek = calculateCalendarWeek(now);

  function handleRecipeAdd(recipe: Recipe) {
    setRecipes((prev) => [...prev, recipe]);
    saveRecipe(recipe);
  }

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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{t.appTitle}</h1>
            <p className="text-xs text-slate-500">{t.appSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 active:scale-95"
          >
            <Languages size={14} />
            {LANGUAGES[lang]}
          </button>
        </div>
        <div className="mt-3 hidden sm:block">
          <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </header>

      <main className="flex-1 space-y-4 p-4">
        {activeTab === 'plan' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-700">
                {plan ? t.weekLabel(plan.calendarWeek, plan.year) : t.nextWeek(currentWeek + 1)}
              </h2>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-white active:scale-95 disabled:opacity-60"
              >
                <Sparkles size={16} />
                {plan ? t.regenerate : t.generate}
              </button>
            </div>

            {!plan && (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
                {t.noPlanYet}
              </div>
            )}

            {plan &&
              plan.days.map((day) => (
                <DayMenuCard
                  key={day.dayOfWeek}
                  day={day}
                  onReroll={() => handleReroll(day.dayOfWeek)}
                  onOpenRecipe={setSelectedRecipe}
                />
              ))}

            {plan && (
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={plan.isFinalized}
                  className="flex-1 rounded-full border border-brand-700 px-4 py-2 text-sm font-medium text-brand-700 disabled:opacity-50"
                >
                  {plan.isFinalized ? t.finalized : t.finalize}
                </button>
                <button
                  type="button"
                  onClick={() => exportWeeklyPlanPdf(plan, lang)}
                  className="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
                >
                  <FileDown size={16} />
                  {t.pdf}
                </button>
              </div>
            )}
          </section>
        )}

        {activeTab === 'einkauf' && plan && (
          <section className="space-y-8">
            <CheckboxList
              title={t.shoppingMon}
              items={plan.shoppingListMon}
              onToggle={(item) => toggleItem('shoppingListMon', item)}
            />
            <CheckboxList
              title={t.shoppingFri}
              items={plan.shoppingListFri}
              onToggle={(item) => toggleItem('shoppingListFri', item)}
            />
          </section>
        )}
        {activeTab === 'einkauf' && !plan && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            {t.needPlanForShopping}
          </div>
        )}

        {activeTab === 'chat' && (
          <ChatPanel
            plan={plan}
            recipes={recipes}
            recentRecipeIds={recentRecipeIds}
            calendarWeek={currentWeek}
            year={now.getFullYear()}
            onPlanUpdate={setPlan}
            onRecipeAdd={handleRecipeAdd}
          />
        )}

        {activeTab === 'archiv' && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-700">{t.archivedPlans}</h2>
            {archive.length === 0 && <p className="text-sm text-slate-400">{t.noArchivedPlans}</p>}
            <ul className="space-y-2">
              {archive.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <span>{t.weekLabel(p.calendarWeek, p.year)}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(p.createdAt).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'de-DE')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <div className="sm:hidden">
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {selectedRecipe && (
        <RecipeDetailModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
      )}
    </div>
  );
}
