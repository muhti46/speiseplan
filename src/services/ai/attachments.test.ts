import { describe, expect, it } from 'vitest';
import { ChatAttachment, ChatMessage } from '../../types/ai';
import { classifyAttachmentFile, toContents, toDisplayAttachment } from './attachments';

const photo = (name: string): ChatAttachment => ({ kind: 'image', name, mimeType: 'image/jpeg', data: 'AAAA' });

describe('classifyAttachmentFile', () => {
  it('accepts images and PDFs, rejects everything else', () => {
    expect(classifyAttachmentFile({ type: 'image/jpeg', name: 'a.jpg' })).toBe('image');
    expect(classifyAttachmentFile({ type: 'application/pdf', name: 'r.pdf' })).toBe('pdf');
    expect(classifyAttachmentFile({ type: '', name: 'Rezept.PDF' })).toBe('pdf');
    expect(classifyAttachmentFile({ type: 'text/plain', name: 'a.txt' })).toBeNull();
  });
});

describe('toContents', () => {
  it('sends attachments as inlineData before the text part', () => {
    const contents = toContents([{ role: 'user', text: 'Füge das hinzu', attachments: [photo('a.jpg')] }]);
    expect(contents).toEqual([
      { role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }, { text: 'Füge das hinzu' }] },
    ]);
  });

  it('drops system messages and only resends the newest attachments', () => {
    const history: ChatMessage[] = [
      { role: 'user', text: '1', attachments: [photo('alt.jpg')] },
      { role: 'assistant', text: 'ok' },
      { role: 'system', text: 'Fehler' },
      { role: 'user', text: '2', attachments: [photo('b.jpg')] },
      { role: 'assistant', text: 'ok' },
      { role: 'user', text: '3', attachments: [photo('c.jpg')] },
    ];
    const contents = toContents(history);
    expect(contents).toHaveLength(5);
    expect(contents[0].parts?.[0]).toHaveProperty('text');
    expect(contents[0].parts?.[0].text).toContain('alt.jpg');
    expect(contents[2].parts?.[0]).toHaveProperty('inlineData');
    expect(contents[4].parts?.[0]).toHaveProperty('inlineData');
    expect(contents[1]).toEqual({ role: 'model', parts: [{ text: 'ok' }] });
  });
});

describe('toDisplayAttachment', () => {
  it('keeps image data for thumbnails but strips PDF data', () => {
    expect(toDisplayAttachment(photo('a.jpg')).data).toBe('AAAA');
    expect(
      toDisplayAttachment({ kind: 'pdf', name: 'r.pdf', mimeType: 'application/pdf', data: 'BBBB' }).data,
    ).toBe('');
  });
});
