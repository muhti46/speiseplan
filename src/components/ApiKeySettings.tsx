import { FormEvent, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { setApiKey } from '../services/ai/apiKey';
import { useLanguage } from '../i18n/LanguageContext';

interface ApiKeySettingsProps {
  onSaved: () => void;
}

export default function ApiKeySettings({ onSaved }: ApiKeySettingsProps) {
  const { t } = useLanguage();
  const [value, setValue] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    setApiKey(value);
    onSaved();
  }

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <KeyRound size={16} className="text-brand-600" />
        {t.chatApiKeyLabel}
      </div>
      <p className="mb-3 text-xs text-slate-500">{t.chatApiKeyHint}</p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t.chatApiKeyPlaceholder}
          className="flex-1 rounded-full border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-white active:scale-95"
        >
          {t.chatApiKeySave}
        </button>
      </form>
    </div>
  );
}
