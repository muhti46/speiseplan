/**
 * Entfernt Markdown-Überbleibsel aus KI-Antworten (Sternchen, Rauten, Backticks),
 * falls sich das Modell trotz Anweisung im System-Prompt nicht daran hält -
 * für eine saubere, rein textuelle Darstellung im Chat.
 */
export function sanitizeAssistantText(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/^[*-]\s+/gm, '• ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
