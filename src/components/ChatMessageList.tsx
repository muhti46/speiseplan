import { useEffect, useRef } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types/ai';
import { useLanguage } from '../i18n/LanguageContext';
import { sanitizeAssistantText } from '../services/ai/textFormat';
import TypewriterText from './TypewriterText';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isSending: boolean;
  animatingMessageId?: string | null;
  onAnimationDone?: () => void;
}

export default function ChatMessageList({
  messages,
  isSending,
  animatingMessageId,
  onAnimationDone,
}: ChatMessageListProps) {
  const { t } = useLanguage();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Während der Tipp-Animation wächst die Bubble, ohne dass sich `messages` ändert -
  // also regelmäßig mitscrollen, solange eine Nachricht gerade eingeblendet wird.
  useEffect(() => {
    if (!animatingMessageId) return;
    const id = window.setInterval(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 150);
    return () => window.clearInterval(id);
  }, [animatingMessageId]);

  return (
    <div className="flex-1 space-y-4 overflow-y-auto py-3">
      {messages.length === 0 && !isSending && (
        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 p-4 text-base leading-relaxed text-slate-400">
          <Sparkles size={16} className="text-brand-600" />
          {t.chatEmptyState}
        </div>
      )}

      {messages.map((message, index) => {
        const isAssistant = message.role === 'assistant';
        const displayText = isAssistant ? sanitizeAssistantText(message.text) : message.text;
        const isAnimating = isAssistant && message.id !== undefined && message.id === animatingMessageId;

        return (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-base leading-relaxed ${
                message.role === 'user'
                  ? 'bg-brand-700 text-white'
                  : message.role === 'system'
                    ? 'border border-red-200 bg-red-50 text-red-700'
                    : 'bg-slate-100 text-slate-800'
              }`}
            >
              {isAnimating ? (
                <TypewriterText text={displayText} onDone={onAnimationDone} />
              ) : (
                displayText
              )}
            </div>
          </div>
        );
      })}

      {isSending && (
        <div className="flex justify-start">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-base text-slate-500">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            {t.chatThinking}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
