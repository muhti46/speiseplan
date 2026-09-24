import { useEffect, useRef } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types/ai';
import { useLanguage } from '../i18n/LanguageContext';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isSending: boolean;
}

export default function ChatMessageList({ messages, isSending }: ChatMessageListProps) {
  const { t } = useLanguage();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto py-3">
      {messages.length === 0 && !isSending && (
        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-400">
          <Sparkles size={16} className="text-brand-600" />
          {t.chatEmptyState}
        </div>
      )}

      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
              message.role === 'user'
                ? 'bg-brand-700 text-white'
                : message.role === 'system'
                  ? 'border border-red-200 bg-red-50 text-red-700'
                  : 'bg-slate-100 text-slate-800'
            }`}
          >
            {message.text}
          </div>
        </div>
      ))}

      {isSending && (
        <div className="flex justify-start">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            {t.chatThinking}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
