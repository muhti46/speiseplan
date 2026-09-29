import { Plus, Trash2 } from 'lucide-react';
import { ChatConversation } from '../types/ai';
import { useLanguage } from '../i18n/LanguageContext';

interface ConversationListProps {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNew,
}: ConversationListProps) {
  const { lang, t } = useLanguage();

  return (
    <div className="flex-1 space-y-3 overflow-y-auto py-3">
      <button
        type="button"
        onClick={onNew}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-4 py-2.5 text-sm font-medium text-white active:scale-95"
      >
        <Plus size={16} />
        {t.chatNewConversation}
      </button>

      {conversations.length === 0 && (
        <p className="pt-4 text-center text-sm text-slate-400">{t.chatNoConversations}</p>
      )}

      <ul className="space-y-2">
        {conversations.map((conv) => {
          const isActive = conv.id === activeId;
          return (
            <li key={conv.id}>
              <button
                type="button"
                onClick={() => onSelect(conv.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm ${
                  isActive
                    ? 'border-brand-300 bg-brand-50 text-brand-800'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{conv.title}</span>
                  <span className="block text-xs text-slate-400">
                    {new Date(conv.updatedAt).toLocaleString(lang === 'tr' ? 'tr-TR' : 'de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }
                  }}
                  aria-label={t.chatDeleteConversation}
                  className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
