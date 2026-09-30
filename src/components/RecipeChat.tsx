import { useEffect, useRef, useState } from 'react';
import { Loader2, MessageCircle, Trash2 } from 'lucide-react';
import { ChatMessage } from '../types/ai';
import { Recipe, RecipeDetail } from '../types/recipe';
import { askAboutRecipe } from '../services/ai/recipeChat';
import { describeChatError } from '../services/ai/chat';
import { getApiKey } from '../services/ai/apiKey';
import { sanitizeAssistantText } from '../services/ai/textFormat';
import { deleteRecipeChat, getRecipeChat, saveRecipeChat } from '../services/storage';
import { useLanguage } from '../i18n/LanguageContext';
import ChatInput from './ChatInput';
import TypewriterText from './TypewriterText';

interface RecipeChatProps {
  recipe: Recipe;
  detail?: RecipeDetail;
}

/** Kleiner, dauerhaft gespeicherter Chat zu einem einzelnen Rezept (ein Verlauf je Rezept). */
export default function RecipeChat({ recipe, detail }: RecipeChatProps) {
  const { lang, t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const skipScroll = useRef(true);

  useEffect(() => {
    let cancelled = false;
    getRecipeChat(recipe.id).then((stored) => {
      if (cancelled) return;
      setMessages(stored?.messages ?? []);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [recipe.id]);

  // Erst nach einer neuen Nachricht zum Ende scrollen, nicht beim bloßen Öffnen des Rezepts.
  useEffect(() => {
    if (skipScroll.current) {
      skipScroll.current = false;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length, isSending, error]);

  async function handleSend(text: string) {
    setError(null);
    const apiKey = getApiKey();
    if (!apiKey) return setError(t.aiFillNoKey);
    if (!navigator.onLine) return setError(t.chatOffline);

    const withQuestion: ChatMessage[] = [...messages, { role: 'user', text }];
    setMessages(withQuestion);
    setIsSending(true);
    try {
      const answer = await askAboutRecipe(apiKey, recipe, detail, messages, text, lang);
      const next: ChatMessage[] = [...withQuestion, { role: 'assistant', text: answer }];
      setMessages(next);
      setAnimatingIndex(next.length - 1);
      saveRecipeChat({ recipeId: recipe.id, messages: next, updatedAt: new Date().toISOString() });
    } catch (err) {
      const { status, message } = describeChatError(err);
      // eslint-disable-next-line no-console
      console.error('Rezept-Chat fehlgeschlagen', status, message, err);
      // Frage zurücknehmen, damit der Verlauf nie zwei user-Turns hintereinander enthält.
      setMessages(messages);
      let errorText = t.chatError;
      if (status === 401 || status === 403) errorText = t.chatErrorAuth;
      else if (status === 429) errorText = t.chatErrorQuota;
      setError([errorText, [status, message].filter(Boolean).join(' ')].filter(Boolean).join('\n\n'));
    } finally {
      setIsSending(false);
    }
  }

  function handleDelete() {
    if (!window.confirm(t.chatDeleteConversationConfirm)) return;
    setMessages([]);
    setError(null);
    setAnimatingIndex(null);
    deleteRecipeChat(recipe.id);
  }

  return (
    <section className="mt-6 border-t border-slate-100 pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          <MessageCircle size={16} />
          {t.recipeChatTitle}
        </h3>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 size={12} />
            {t.chatDeleteConversation}
          </button>
        )}
      </div>

      {loaded && messages.length === 0 && !isSending && !error && (
        <p className="mb-2 rounded-xl border border-dashed border-slate-300 p-3 text-sm leading-relaxed text-slate-400">
          {t.recipeChatEmpty}
        </p>
      )}

      <div className="space-y-3">
        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          const text = isUser ? message.text : sanitizeAssistantText(message.text);
          return (
            <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-base leading-relaxed ${
                  isUser ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {!isUser && index === animatingIndex ? (
                  <TypewriterText text={text} onDone={() => setAnimatingIndex(null)} />
                ) : (
                  text
                )}
              </div>
            </div>
          );
        })}
        {isSending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3.5 py-2.5 text-base text-slate-500">
              <Loader2 size={14} className="animate-spin" aria-hidden />
              {t.chatThinking}
            </div>
          </div>
        )}
        {error && (
          <p className="whitespace-pre-wrap rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput disabled={isSending} onSend={handleSend} placeholder={t.recipeChatPlaceholder} />
    </section>
  );
}
