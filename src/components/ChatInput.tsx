import { KeyboardEvent, useState } from 'react';
import { Send } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface ChatInputProps {
  disabled: boolean;
  onSend: (text: string) => void;
}

export default function ChatInput({ disabled, onSend }: ChatInputProps) {
  const { t } = useLanguage();
  const [value, setValue] = useState('');

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-slate-100 pt-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t.chatPlaceholder}
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none disabled:opacity-60"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label={t.chatSend}
        className="shrink-0 rounded-full bg-brand-700 p-2.5 text-white active:scale-95 disabled:opacity-50"
      >
        <Send size={18} />
      </button>
    </div>
  );
}
