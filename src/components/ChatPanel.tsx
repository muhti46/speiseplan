import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Recipe } from '../types/recipe';
import { WeeklyPlan } from '../types/menu';
import { ChatMessage } from '../types/ai';
import { useLanguage } from '../i18n/LanguageContext';
import { getApiKey, clearApiKey } from '../services/ai/apiKey';
import { sendChatMessage } from '../services/ai/chat';
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  function handleClearKey() {
    clearApiKey();
    setHasKey(false);
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

    const history = messages;
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
      setMessages((prev) => [...prev, { role: 'assistant', text: reply || t.chatError }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'system', text: t.chatError }]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="flex h-[calc(100vh-9rem)] flex-col sm:h-[calc(100vh-11rem)]">
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-base font-semibold text-slate-700">{t.chatTitle}</h2>
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
