import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ShoppingCart,
  Archive,
  Sparkles,
  FileDown,
  Languages,
  MessageCircle,
  Plus,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import recipesData from './data/recipes.json';
import { Course, Recipe } from './types/recipe';
import { DayOfWeek, ShoppingItem, WeeklyPlan } from './types/menu';
import { applyBeilageChange, applyMealSwap, calculateCalendarWeek, generateWeeklyPlan, rerollDay } from './services/generator';
import { buildShoppingLists, preserveChecked } from './services/shopping';
import { exportWeeklyPlanPdf } from './services/pdf';
import {
  getAllPlans,
  getAllRecipes,
  getCurrentPlan,
  getRecentRecipeIds,
  saveCurrentPlan,
  saveRecipe,
  savePlan,
} from './services/storage';
import Tabs, { TabItem } from './components/Tabs';
import DayMenuCard from './components/DayMenuCard';
import CheckboxList from './components/CheckboxList';
import RecipeDetailModal from './components/RecipeDetailModal';
import RecipePickerModal from './components/RecipePickerModal';
import BeilagePickerModal from './components/BeilagePickerModal';
import AddRecipeModal from './components/AddRecipeModal';
import ChatPanel from './components/ChatPanel';
import { useLanguage } from './i18n/LanguageContext';
import { LANGUAGES, Lang } from './i18n/translations';

export default function App() {
  const { lang, setLang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('plan');
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [archive, setArchive] = useState<WeeklyPlan[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  // `dayOfWeek`/`course` sind nur gesetzt, wenn das Rezept ein Gang im Wochenplan ist (änderbar).
  const [selected, setSelected] = useState<{ recipe: Recipe; dayOfWeek?: DayOfWeek; course?: Course } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showAddForSlot, setShowAddForSlot] = useState(false);
  const [beilageDay, setBeilageDay] = useState<DayOfWeek | null>(null);
  const [viewingArchiveId, setViewingArchiveId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>(recipesData as Recipe[]);
  const [recentRecipeIds, setRecentRecipeIds] = useState<string[]>([]);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  // Erst nach dem Laden des gespeicherten Plans darf gespeichert werden, sonst würde der
  // anfängliche leere State den gespeicherten Plan überschreiben.
  const [planLoaded, setPlanLoaded] = useState(false);

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
    getCurrentPlan()
      .then((stored) => {
        if (stored) setPlan((prev) => prev ?? stored);
      })
      .finally(() => setPlanLoaded(true));
  }, []);

  useEffect(() => {
    if (planLoaded && plan) saveCurrentPlan(plan);
  }, [plan, planLoaded]);

  const now = useMemo(() => new Date(), []);
  const currentWeek = calculateCalendarWeek(now);

  function handleRecipeAdd(recipe: Recipe) {
    setRecipes((prev) => [...prev, recipe]);
    saveRecipe(recipe);
  }

  /** Ersetzt den geöffneten Gang (Vorspeise/Hauptspeise/Nachspeise) des Tages manuell durch `recipe`. */
  function handleAssignMeal(recipe: Recipe) {
    if (!plan || !selected?.dayOfWeek || !selected.course) return;
    const swapped = applyMealSwap(plan, selected.dayOfWeek, selected.course, recipe);
    const lists = buildShoppingLists(swapped);
    const updated: WeeklyPlan = {
      ...swapped,
      shoppingListMon: preserveChecked(plan.shoppingListMon, lists.shoppingListMon),
      shoppingListFri: preserveChecked(plan.shoppingListFri, lists.shoppingListFri),
    };
    setPlan(updated);
    if (updated.isFinalized) savePlan(updated);
    setSelected({ ...selected, recipe });
    setShowPicker(false);
    setShowAddForSlot(false);
  }

  /** Macht einen archivierten Plan zum aktuellen Plan (ersetzt den bisherigen). */
  function handleLoadArchived(archived: WeeklyPlan) {
    if (plan && plan.id !== archived.id && !window.confirm(t.archiveLoadConfirm)) return;
    setPlan(archived);
    setViewingArchiveId(null);
    setActiveTab('plan');
  }

  function handleAssignBeilage(beilage: string) {
    if (!plan || !beilageDay) return;
    const updated = applyBeilageChange(plan, beilageDay, beilage);
    setPlan(updated);
    if (updated.isFinalized) savePlan(updated);
    setBeilageDay(null);
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
    <div className="mx-auto flex min-h-[var(--app-height)] w-full max-w-xl flex-col pb-20 sm:pb-6">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" width={32} height={32} className="rounded-lg" />
            <div>
              <h1 className="text-lg font-bold text-slate-800">{t.appTitle}</h1>
              <p className="text-xs text-slate-500">{t.appSubtitle}</p>
            </div>
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddRecipe(true)}
                  aria-label={t.addRecipeTitle}
                  className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 active:scale-95"
                >
                  <Plus size={16} />
                </button>
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
                  onChangeBeilage={() => setBeilageDay(day.dayOfWeek)}
                  onOpenRecipe={(recipe, course) =>
                    setSelected({ recipe, dayOfWeek: course ? day.dayOfWeek : undefined, course })
                  }
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

        {activeTab === 'archiv' && (() => {
          const viewed = archive.find((p) => p.id === viewingArchiveId);
          if (viewed) {
            return (
              <section className="space-y-4">
                <button
                  type="button"
                  onClick={() => setViewingArchiveId(null)}
                  className="flex items-center gap-1.5 text-sm font-medium text-brand-700"
                >
                  <ArrowLeft size={16} />
                  {t.archiveBack}
                </button>
                <h2 className="text-base font-semibold text-slate-700">
                  {t.weekLabel(viewed.calendarWeek, viewed.year)}
                </h2>
                {viewed.days.map((day) => (
                  <DayMenuCard
                    key={day.dayOfWeek}
                    day={day}
                    onOpenRecipe={(recipe) => setSelected({ recipe })}
                  />
                ))}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleLoadArchived(viewed)}
                    className="flex-1 rounded-full border border-brand-700 px-4 py-2 text-sm font-medium text-brand-700 active:scale-95"
                  >
                    {t.archiveLoad}
                  </button>
                  <button
                    type="button"
                    onClick={() => exportWeeklyPlanPdf(viewed, lang)}
                    className="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
                  >
                    <FileDown size={16} />
                    {t.pdf}
                  </button>
                </div>
              </section>
            );
          }
          return (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-700">{t.archivedPlans}</h2>
              {archive.length === 0 && <p className="text-sm text-slate-400">{t.noArchivedPlans}</p>}
              <ul className="space-y-2">
                {archive.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setViewingArchiveId(p.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm active:bg-slate-50"
                    >
                      <span className="font-medium text-slate-700">{t.weekLabel(p.calendarWeek, p.year)}</span>
                      <span className="flex items-center gap-2 text-xs text-slate-400">
                        {new Date(p.createdAt).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'de-DE')}
                        <ChevronRight size={16} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })()}
      </main>

      <div className="sm:hidden">
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {selected && (
        <RecipeDetailModal
          recipe={selected.recipe}
          // Solange ein darüberliegendes Fenster offen ist, soll Escape nur dieses schließen.
          onClose={() => {
            if (!showPicker && !showAddForSlot) setSelected(null);
          }}
          onChange={selected.course ? () => setShowPicker(true) : undefined}
        />
      )}

      {selected?.course && showPicker && (
        <RecipePickerModal
          course={selected.course}
          currentId={selected.recipe.id}
          recipes={recipes}
          onSelect={handleAssignMeal}
          onCreateNew={() => {
            setShowPicker(false);
            setShowAddForSlot(true);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {selected?.course && showAddForSlot && (
        <AddRecipeModal
          fixedCourse={selected.course}
          onSave={(recipe) => {
            handleRecipeAdd(recipe);
            handleAssignMeal(recipe);
          }}
          onClose={() => setShowAddForSlot(false)}
        />
      )}

      {beilageDay && plan && (
        <BeilagePickerModal
          current={plan.days.find((d) => d.dayOfWeek === beilageDay)?.beilage ?? '—'}
          onSelect={handleAssignBeilage}
          onClose={() => setBeilageDay(null)}
        />
      )}

      {showAddRecipe && (
        <AddRecipeModal onSave={handleRecipeAdd} onClose={() => setShowAddRecipe(false)} />
      )}
    </div>
  );
}
