import { useEffect, useState } from 'react';
import { KeyRound, MessagesSquare, Plus } from 'lucide-react';
import { Recipe } from '../types/recipe';
import { WeeklyPlan } from '../types/menu';
import { ChatConversation } from '../types/ai';
import { useLanguage } from '../i18n/LanguageContext';
import { getApiKey, clearApiKey } from '../services/ai/apiKey';
import { describeChatError, sendChatMessage } from '../services/ai/chat';
import { createConversation, migrateLegacyChatHistory, titleFromFirstMessage } from '../services/ai/chatHistory';
import { deleteConversation, getAllConversations, saveConversation } from '../services/storage';
import ApiKeySettings from './ApiKeySettings';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import ConversationList from './ConversationList';

interface ChatPanelProps {
  plan: WeeklyPlan | null;
  recipes: Recipe[];
  recentRecipeIds: string[];
  calendarWeek: number;
  year: number;
  onPlanUpdate: (plan: WeeklyPlan) => void;
  onRecipeAdd: (recipe: Recipe) => void;
}

function newMessageId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `msg-${Date.now()}`;
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
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showList, setShowList] = useState(false);
  const [isSending, setIsSending] = useState(false);
  // Nur die zuletzt frisch eingetroffene Assistant-Nachricht bekommt den Tipp-Effekt.
  const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await migrateLegacyChatHistory(t.chatNewConversation);
      const list = await getAllConversations();
      if (cancelled) return;
      if (list.length === 0) {
        const first = createConversation(t.chatNewConversation);
        setConversations([first]);
        setActiveId(first.id);
      } else {
        setConversations(list);
        setActiveId(list[0].id);
      }
      setIsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  function updateConversation(id: string, updater: (conv: ChatConversation) => ChatConversation) {
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === id ? updater(c) : c));
      const updated = next.find((c) => c.id === id);
      if (updated) saveConversation(updated);
      return next;
    });
  }

  function handleClearKey() {
    // Bestätigung, damit ein versehentliches Antippen des Icons den gespeicherten
    // Key nicht sofort und ohne Vorwarnung löscht.
    if (!window.confirm(t.chatApiKeyClearConfirm)) return;
    clearApiKey();
    setHasKey(false);
  }

  function handleNewConversation() {
    const fresh = createConversation(t.chatNewConversation);
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setAnimatingMessageId(null);
    setShowList(false);
  }

  function handleSelectConversation(id: string) {
    setActiveId(id);
    setAnimatingMessageId(null);
    setShowList(false);
  }

  function handleDeleteConversation(id: string) {
    if (!window.confirm(t.chatDeleteConversationConfirm)) return;
    deleteConversation(id);
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (id === activeId) {
        if (remaining.length > 0) {
          setActiveId(remaining[0].id);
        } else {
          const fresh = createConversation(t.chatNewConversation);
          setActiveId(fresh.id);
          return [fresh];
        }
      }
      return remaining;
    });
    setAnimatingMessageId(null);
  }

  async function handleSend(text: string) {
    const apiKey = getApiKey();
    if (!apiKey || !active) {
      if (!apiKey) setHasKey(false);
      return;
    }

    if (!navigator.onLine) {
      updateConversation(active.id, (c) => ({
        ...c,
        messages: [...c.messages, { role: 'user', text }, { role: 'system', text: t.chatOffline }],
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    const history = active.apiHistory;
    const isFirstMessage = active.messages.length === 0;
    updateConversation(active.id, (c) => ({
      ...c,
      title: isFirstMessage ? titleFromFirstMessage(text, c.title) : c.title,
      messages: [...c.messages, { role: 'user', text }],
      updatedAt: new Date().toISOString(),
    }));
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
      const assistantId = newMessageId();
      updateConversation(active.id, (c) => ({
        ...c,
        messages: [...c.messages, { role: 'assistant', text: assistantText, id: assistantId }],
        apiHistory: [...c.apiHistory, { role: 'user', text }, { role: 'assistant', text: assistantText }],
        updatedAt: new Date().toISOString(),
      }));
      setAnimatingMessageId(assistantId);
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
      updateConversation(active.id, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          { role: 'system', text: detail ? `${errorText}\n\n${detail}` : errorText },
        ],
        updatedAt: new Date().toISOString(),
      }));
      // apiHistory bewusst unverändert lassen, damit der nächste Send-Versuch
      // keine zwei aufeinanderfolgenden user-Turns an Gemini schickt.
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="flex h-[calc(100vh-9rem)] flex-col sm:h-[calc(100vh-11rem)]">
      <div className="flex items-center justify-between pb-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-700">{t.chatTitle}</h2>
          {active && !showList && (
            <p className="truncate text-xs text-slate-400">{active.title}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {hasKey && (
            <>
              <button
                type="button"
                onClick={handleNewConversation}
                aria-label={t.chatNewConversation}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                onClick={() => setShowList((v) => !v)}
                aria-label={t.chatConversationsToggle}
                className={`rounded-full p-1.5 hover:bg-slate-100 ${
                  showList ? 'text-brand-700' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <MessagesSquare size={16} />
              </button>
            </>
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
      ) : !isLoaded ? null : showList ? (
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
          onNew={handleNewConversation}
        />
      ) : (
        <>
          <ChatMessageList
            messages={active?.messages ?? []}
            isSending={isSending}
            animatingMessageId={animatingMessageId}
            onAnimationDone={() => setAnimatingMessageId(null)}
          />
          <ChatInput disabled={isSending} onSend={handleSend} />
        </>
      )}
    </section>
  );
}
