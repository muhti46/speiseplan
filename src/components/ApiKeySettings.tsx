import { FormEvent, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { setApiKey } from '../services/ai/apiKey';
import { createGeminiClient, GEMINI_MODEL } from '../services/ai/client';
import { describeChatError } from '../services/ai/chat';
import { useLanguage } from '../i18n/LanguageContext';

interface ApiKeySettingsProps {
  onSaved: () => void;
}

export default function ApiKeySettings({ onSaved }: ApiKeySettingsProps) {
  const { t } = useLanguage();
  const [value, setValue] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const key = value.trim();
    if (!key || isValidating) return;

    setError(null);
    setIsValidating(true);
    try {
      // Minimaler Testaufruf, um einen ungültigen/eingeschränkten Key sofort hier
      // sichtbar zu machen statt erst beim ersten echten Chat-Versuch.
      await createGeminiClient(key).models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        config: { maxOutputTokens: 1 },
      });
      setApiKey(key);
      onSaved();
    } catch (err) {
      const { message } = describeChatError(err);
      // eslint-disable-next-line no-console
      console.error('Gemini API-Key-Validierung fehlgeschlagen', err);
      setError(`${t.chatApiKeyInvalid} (${message})`);
    } finally {
      setIsValidating(false);
    }
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
          disabled={isValidating}
          className="flex-1 rounded-full border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isValidating || !value.trim()}
          className="flex shrink-0 items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-white active:scale-95 disabled:opacity-60"
        >
          {isValidating && <Loader2 size={14} className="animate-spin" aria-hidden />}
          {isValidating ? t.chatApiKeyValidating : t.chatApiKeySave}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
