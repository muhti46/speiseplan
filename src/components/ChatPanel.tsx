import { useEffect, useState } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import { Recipe } from '../types/recipe';
import { WeeklyPlan } from '../types/menu';
import { ChatMessage } from '../types/ai';
import { useLanguage } from '../i18n/LanguageContext';
import { getApiKey, clearApiKey } from '../services/ai/apiKey';
import { describeChatError, sendChatMessage } from '../services/ai/chat';
import { clearChatHistory, getChatHistory, saveChatHistory } from '../services/ai/chatHistory';
import ApiKeySettings from './ApiKeySettings';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';

interface ChatPanelProps {
  plan: WeeklyPlan | null;
  recipes: Recipe[];
  recentRecipeIds: string[];
  calendarWeek: number;
  year: number;
  onPlanUpdate: (plan: WeeklyPlan) => void;
  onRecipeAdd: (recipe: Recipe) => void;
}

export default function ChatPanel({
  plan,
  recipes,
  recentRecipeIds,
  calendarWeek,
  year,
  onPlanUpdate,
  onRecipeAdd,
}: ChatPanelProps) {
  const { lang, t } = useLanguage();
  const [hasKey, setHasKey] = useState(() => Boolean(getApiKey()));
  // `messages` ist der volle UI-Verlauf (inkl. Fehler-/Offline-Hinweisen).
  // `apiHistory` enthält NUR erfolgreich abgeschlossene user/assistant-Paare und wird
  // an Gemini geschickt - so bleibt die Rollen-Abfolge (user/model/user/model/...) auch
  // nach einem Fehlschlag konsistent, statt zwei aufeinanderfolgende user-Turns zu erzeugen.
  // Beide werden aus localStorage vorbefüllt, damit der Verlauf Tab-Wechsel und
  // Neuladen übersteht und nur bei explizitem "Verlauf löschen" verschwindet.
  const [messages, setMessages] = useState<ChatMessage[]>(() => getChatHistory().messages);
  const [apiHistory, setApiHistory] = useState<ChatMessage[]>(() => getChatHistory().apiHistory);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    saveChatHistory(messages, apiHistory);
  }, [messages, apiHistory]);

  function handleClearKey() {
    // Bestätigung, damit ein versehentliches Antippen des Icons den gespeicherten
    // Key nicht sofort und ohne Vorwarnung löscht.
    if (!window.confirm(t.chatApiKeyClearConfirm)) return;
    clearApiKey();
    setHasKey(false);
  }

  function handleClearHistory() {
    if (!window.confirm(t.chatHistoryClearConfirm)) return;
    clearChatHistory();
    setMessages([]);
    setApiHistory([]);
  }

  async function handleSend(text: string) {
    const apiKey = getApiKey();
    if (!apiKey) {
      setHasKey(false);
      return;
    }
    if (!navigator.onLine) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', text },
        { role: 'system', text: t.chatOffline },
      ]);
      return;
    }

    const history = apiHistory;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setIsSending(true);
    try {
      const reply = await sendChatMessage(apiKey, history, text, {
        plan,
        recipes,
        lang,
        recentRecipeIds,
        calendarWeek,
        year,
        onPlanUpdate,
        onRecipeAdd,
      });
      const assistantText = reply || t.chatError;
      setMessages((prev) => [...prev, { role: 'assistant', text: assistantText }]);
      setApiHistory((prev) => [...prev, { role: 'user', text }, { role: 'assistant', text: assistantText }]);
    } catch (err) {
      const { status, message } = describeChatError(err);
      // eslint-disable-next-line no-console
      console.error('Gemini chat error', status, message, err);
      let errorText = t.chatError;
      if (status === 401 || status === 403) errorText = t.chatErrorAuth;
      else if (status === 429) errorText = t.chatErrorQuota;
      // Rohe Fehlermeldung zusätzlich mit anzeigen, damit sie sich (z.B. per
      // Screenshot) ohne Browser-DevTools weitergeben lässt.
      const detail = [status, message].filter(Boolean).join(' ');
      setMessages((prev) => [...prev, { role: 'system', text: detail ? `${errorText}\n\n${detail}` : errorText }]);
      // Bewusst NICHT in apiHistory übernehmen, damit der nächste Send-Versuch
      // keine zwei aufeinanderfolgenden user-Turns an Gemini schickt.
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="flex h-[calc(100vh-9rem)] flex-col sm:h-[calc(100vh-11rem)]">
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-base font-semibold text-slate-700">{t.chatTitle}</h2>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              aria-label={t.chatHistoryClear}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <Trash2 size={16} />
            </button>
          )}
          {hasKey && (
            <button
              type="button"
              onClick={handleClearKey}
              aria-label={t.chatApiKeyClear}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <KeyRound size={16} />
            </button>
          )}
        </div>
      </div>

      {!hasKey ? (
        <ApiKeySettings onSaved={() => setHasKey(true)} />
      ) : (
        <>
          <ChatMessageList messages={messages} isSending={isSending} />
          <ChatInput disabled={isSending} onSend={handleSend} />
        </>
      )}
    </section>
  );
}
