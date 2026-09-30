import { useEffect, useState } from 'react';
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
  Lock,
} from 'lucide-react';
import recipesData from './data/recipes.json';
import { Course, Recipe, RecipeDetail } from './types/recipe';
import { recipeDetailKey } from './services/ai/recipeDetail';
import { DayOfWeek, ShoppingItem, WeeklyPlan } from './types/menu';
import { applyBeilageChange, applyMealSwap, generateWeeklyPlan, getNextIsoWeek, isPlanEditable, replaceRecipeInPlan, rerollDay } from './services/generator';
import { formatWeekRange } from './services/format';
import { buildShoppingLists, preserveChecked } from './services/shopping';
import { exportWeeklyPlanPdf } from './services/pdf';
import {
  getAllPlans,
  getAllRecipeDetails,
  getAllRecipes,
  getCurrentPlan,
  getRecentRecipeIds,
  saveCurrentPlan,
  saveRecipe,
  saveRecipeDetail,
  deleteRecipe,
  deleteRecipeDetailsFor,
  deleteRecipeChat,
  saveRecipeImage,
  deleteRecipeImage,
  getAllRecipeImages,
  savePlan,
} from './services/storage';
import Tabs, { TabItem } from './components/Tabs';
import DayMenuCard from './components/DayMenuCard';
import CheckboxList from './components/CheckboxList';
import RecipeDetailModal from './components/RecipeDetailModal';
import RecipePickerModal from './components/RecipePickerModal';
import BeilagePickerModal from './components/BeilagePickerModal';
import { allBeilageNames, findBeilageRecipe } from './data/beilagen';
import AddRecipeModal from './components/AddRecipeModal';
import ChatPanel from './components/ChatPanel';
import { useLanguage } from './i18n/LanguageContext';
import { LANGUAGES, Lang } from './i18n/translations';

/** Führt Pläne per Id zusammen (`incoming` gewinnt) und sortiert neueste zuerst. */
function upsertPlans(existing: WeeklyPlan[], incoming: WeeklyPlan[]): WeeklyPlan[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  incoming.forEach((p) => byId.set(p.id, p));
  return Array.from(byId.values()).sort(
    (a, b) => b.year * 100 + b.calendarWeek - (a.year * 100 + a.calendarWeek) || b.createdAt.localeCompare(a.createdAt),
  );
}

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
  const [showAddBeilage, setShowAddBeilage] = useState(false);
  const [viewingArchiveId, setViewingArchiveId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, RecipeDetail>>({});
  const [recipes, setRecipes] = useState<Recipe[]>(recipesData as Recipe[]);
  const [recentRecipeIds, setRecentRecipeIds] = useState<string[]>([]);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [images, setImages] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Recipe | null>(null);
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
    // Bereits im State befindliche (frischere) Pläne dürfen vom DB-Stand nicht überschrieben werden.
    getAllPlans().then((stored) => setArchive((prev) => upsertPlans(stored, prev)));
    getAllRecipes().then((stored) => {
      if (stored.length > 0) setRecipes(stored);
    });
    getRecentRecipeIds(4).then(setRecentRecipeIds);
    getAllRecipeImages().then(setImages);
    getAllRecipeDetails().then((list) => setDetails(Object.fromEntries(list.map((d) => [d.key, d]))));
    getCurrentPlan()
      .then((stored) => {
        if (stored) setPlan((prev) => prev ?? stored);
      })
      .finally(() => setPlanLoaded(true));
  }, []);

  // Jede Änderung am Plan (Erzeugen, Tauschen, Abhaken, Freigeben) wird sofort als aktueller Plan
  // gespeichert UND ins Archiv geschrieben. Die Plan-Id enthält Jahr+KW, d.h. pro Woche gibt es
  // genau einen Archiv-Eintrag, der bei Änderungen derselben Woche aktualisiert wird.
  useEffect(() => {
    if (!planLoaded || !plan) return;
    saveCurrentPlan(plan);
    savePlan(plan);
    setArchive((prev) => upsertPlans(prev, [plan]));
  }, [plan, planLoaded]);

  // Der Plan gilt immer für die kommende Woche (passend zur Anzeige "Nächste Woche"). Bei jedem
  // Rendern frisch berechnet, damit eine über den Wochenwechsel offene App nicht veraltet.
  const nextWeek = getNextIsoWeek(new Date());
  const planEditable = plan ? isPlanEditable(plan) : false;

  function handleDetailCreated(detail: RecipeDetail) {
    setDetails((prev) => ({ ...prev, [detail.key]: detail }));
    saveRecipeDetail(detail);
  }

  function handleRecipeAdd(recipe: Recipe) {
    setRecipes((prev) => [...prev, recipe]);
    saveRecipe(recipe);
  }

  /** Speichert ein bearbeitetes Rezept und übernimmt es in den aktuellen Plan samt Einkaufslisten. */
  function handleRecipeUpdate(recipe: Recipe) {
    const old = recipes.find((r) => r.id === recipe.id);
    setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? recipe : r)));
    saveRecipe(recipe);
    if (plan && planEditable) {
      const replaced = replaceRecipeInPlan(plan, recipe);
      if (replaced !== plan) {
        const lists = buildShoppingLists(replaced);
        setPlan({
          ...replaced,
          shoppingListMon: preserveChecked(plan.shoppingListMon, lists.shoppingListMon),
          shoppingListFri: preserveChecked(plan.shoppingListFri, lists.shoppingListFri),
        });
      }
    }
    // Eine ausführliche KI-Anleitung passt nach geänderten Zutaten/Schritten nicht mehr.
    if (
      old &&
      (JSON.stringify(old.instructions) !== JSON.stringify(recipe.instructions) ||
        JSON.stringify(old.ingredients) !== JSON.stringify(recipe.ingredients))
    ) {
      deleteRecipeDetailsFor(recipe.id);
      setDetails((prev) => Object.fromEntries(Object.entries(prev).filter(([, d]) => d.recipeId !== recipe.id)));
    }
    setSelected((prev) => (prev && prev.recipe.id === recipe.id ? { ...prev, recipe } : prev));
  }

  function handleImageChange(recipeId: string, dataUrl: string | null) {
    if (dataUrl) {
      setImages((prev) => ({ ...prev, [recipeId]: dataUrl }));
      saveRecipeImage(recipeId, dataUrl);
    } else {
      setImages(({ [recipeId]: _removed, ...rest }) => rest);
      deleteRecipeImage(recipeId);
    }
  }

  function handleRecipeDelete(recipe: Recipe) {
    if (!window.confirm(t.deleteRecipeConfirm(recipe.name))) return;
    setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
    deleteRecipe(recipe.id);
    deleteRecipeDetailsFor(recipe.id);
    handleImageChange(recipe.id, null);
    deleteRecipeChat(recipe.id);
    setSelected(null);
  }

  /** Ersetzt den geöffneten Gang (Vorspeise/Hauptspeise/Nachspeise) des Tages manuell durch `recipe`. */
  function handleAssignMeal(recipe: Recipe) {
    if (!plan || !planEditable || !selected?.dayOfWeek || !selected.course) return;
    const swapped = applyMealSwap(plan, selected.dayOfWeek, selected.course, recipe);
    const lists = buildShoppingLists(swapped);
    const updated: WeeklyPlan = {
      ...swapped,
      shoppingListMon: preserveChecked(plan.shoppingListMon, lists.shoppingListMon),
      shoppingListFri: preserveChecked(plan.shoppingListFri, lists.shoppingListFri),
    };
    setPlan(updated);
    setSelected({ ...selected, recipe });
    setShowPicker(false);
    setShowAddForSlot(false);
  }

  /** Macht einen archivierten Plan zum aktuellen Plan (ersetzt den bisherigen). */
  function handleLoadArchived(archived: WeeklyPlan) {
    if (!isPlanEditable(archived)) return;
    setPlan(archived);
    setViewingArchiveId(null);
    setActiveTab('plan');
  }

  function handleAssignBeilage(beilage: string) {
    if (!plan || !planEditable || !beilageDay) return;
    const updated = applyBeilageChange(plan, beilageDay, beilage);
    setPlan(updated);
    setBeilageDay(null);
    setShowAddBeilage(false);
  }

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const recentRecipeIds = await getRecentRecipeIds(4);
      const newPlan = generateWeeklyPlan(recipes, {
        calendarWeek: nextWeek.calendarWeek,
        year: nextWeek.year,
        recentRecipeIds,
      });
      const { shoppingListMon, shoppingListFri } = buildShoppingLists(newPlan);
      setPlan({ ...newPlan, shoppingListMon, shoppingListFri });
    } finally {
      setIsGenerating(false);
    }
  }

  function handleReroll(dayOfWeek: DayOfWeek) {
    if (!plan || !planEditable) return;
    const updated = rerollDay(recipes, plan, dayOfWeek);
    const { shoppingListMon, shoppingListFri } = buildShoppingLists(updated);
    setPlan({ ...updated, shoppingListMon, shoppingListFri });
  }

  function handleFinalize() {
    if (!plan || !planEditable) return;
    setPlan({ ...plan, isFinalized: true });
  }

  function toggleItem(list: 'shoppingListMon' | 'shoppingListFri', item: ShoppingItem) {
    if (!plan) return;
    const updatedList = plan[list].map((i) =>
      i.item === item.item && i.unit === item.unit ? { ...i, checked: !i.checked } : i,
    );
    const updatedPlan = { ...plan, [list]: updatedList };
    setPlan(updatedPlan);
  }

  return (
    <div className="mx-auto flex min-h-[var(--app-height)] w-full max-w-xl flex-col pb-20 sm:pb-6">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" width={32} height={32} className="rounded-lg" />
            <div>
              <h1 className="text-lg font-bold text-slate-800">{t.appTitle}</h1>
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
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-slate-700">
                {plan ? t.weekLabel(plan.calendarWeek, plan.year) : t.nextWeek(nextWeek.calendarWeek)}
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddRecipe(true)}
                  className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm font-semibold leading-tight text-brand-800 shadow-sm transition-colors hover:bg-brand-100 active:scale-95"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Plus size={14} strokeWidth={3} />
                  </span>
                  {t.addRecipeTitle}
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-brand-700 px-3 py-2.5 text-sm font-semibold leading-tight text-white shadow-sm transition-colors hover:bg-brand-800 active:scale-95 disabled:opacity-60"
                >
                  <Sparkles size={16} className="shrink-0" />
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
                  onReroll={planEditable ? () => handleReroll(day.dayOfWeek) : undefined}
                  beilageRecipe={findBeilageRecipe(day.beilage, recipes)}
                  onChangeBeilage={planEditable ? () => setBeilageDay(day.dayOfWeek) : undefined}
                  onOpenRecipe={(recipe, course) =>
                    setSelected({ recipe, dayOfWeek: course && planEditable ? day.dayOfWeek : undefined, course: planEditable ? course : undefined })
                  }
                />
              ))}

            {plan && !planEditable && (
              <p className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
                <Lock size={14} className="shrink-0" />
                {t.planLocked}
              </p>
            )}

            {plan && (
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={plan.isFinalized || !planEditable}
                  className="flex-1 rounded-full border border-brand-700 px-4 py-2 text-sm font-medium text-brand-700 disabled:opacity-50"
                >
                  {plan.isFinalized ? t.finalized : t.finalize}
                </button>
                <button
                  type="button"
                  onClick={() => exportWeeklyPlanPdf(plan)}
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
            plan={planEditable ? plan : null}
            recipes={recipes}
            recentRecipeIds={recentRecipeIds}
            calendarWeek={nextWeek.calendarWeek}
            year={nextWeek.year}
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
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {formatWeekRange(viewed.calendarWeek, viewed.year)}
                  </span>
                </h2>
                {viewed.days.map((day) => (
                  <DayMenuCard
                    key={day.dayOfWeek}
                    day={day}
                    beilageRecipe={findBeilageRecipe(day.beilage, recipes)}
                    onOpenRecipe={(recipe) => setSelected({ recipe })}
                  />
                ))}
                <div className="flex gap-3 pt-2">
                  {isPlanEditable(viewed) ? (
                    <button
                      type="button"
                      onClick={() => handleLoadArchived(viewed)}
                      className="flex-1 rounded-full border border-brand-700 px-4 py-2 text-sm font-medium text-brand-700 active:scale-95"
                    >
                      {t.archiveLoad}
                    </button>
                  ) : (
                    <p className="flex flex-1 items-center gap-2 text-xs text-slate-500">
                      <Lock size={14} className="shrink-0" />
                      {t.planLocked}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => exportWeeklyPlanPdf(viewed)}
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
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{t.weekLabel(p.calendarWeek, p.year)}</span>
                        {!isPlanEditable(p) && <Lock size={12} className="text-slate-400" aria-hidden />}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.isFinalized ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {p.isFinalized ? t.archiveBadgeFinal : t.archiveBadgeDraft}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-slate-400">
                        {formatWeekRange(p.calendarWeek, p.year)}
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
          detail={details[recipeDetailKey(selected.recipe.id, lang)]}
          image={images[selected.recipe.id]}
          onImageChange={(dataUrl) => handleImageChange(selected.recipe.id, dataUrl)}
          onDetailCreated={handleDetailCreated}
          // Solange ein darüberliegendes Fenster offen ist, soll Escape nur dieses schließen.
          onClose={() => {
            if (!showPicker && !showAddForSlot && !editing) setSelected(null);
          }}
          onChange={selected.course ? () => setShowPicker(true) : undefined}
          onEdit={() => setEditing(selected.recipe)}
          onDelete={
            selected.recipe.source === 'manual' || selected.recipe.source === 'ai'
              ? () => handleRecipeDelete(selected.recipe)
              : undefined
          }
        />
      )}

      {editing && (
        <AddRecipeModal
          initial={editing}
          onSave={handleRecipeUpdate}
          onClose={() => setEditing(null)}
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

      {beilageDay && plan && !showAddBeilage && (
        <BeilagePickerModal
          current={plan.days.find((d) => d.dayOfWeek === beilageDay)?.beilage ?? '—'}
          beilagen={allBeilageNames(recipes)}
          onCreateNew={() => setShowAddBeilage(true)}
          onSelect={handleAssignBeilage}
          onClose={() => setBeilageDay(null)}
        />
      )}

      {beilageDay && plan && showAddBeilage && (
        <AddRecipeModal
          beilageMode
          onSave={(recipe) => {
            handleRecipeAdd(recipe);
            handleAssignBeilage(recipe.name);
          }}
          onClose={() => setShowAddBeilage(false)}
        />
      )}

      {showAddRecipe && (
        <AddRecipeModal onSave={handleRecipeAdd} onClose={() => setShowAddRecipe(false)} />
      )}
    </div>
  );
}
