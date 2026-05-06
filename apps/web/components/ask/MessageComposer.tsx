'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@perfin/ui';

export function MessageComposer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  }
  return (
    <form onSubmit={submit} className="sticky bottom-0 bg-bg pt-3 border-t border-border">
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Ask anything about your money…"
          className="flex-1 px-3 py-2 rounded-md bg-surface-2 border border-border-strong text-text resize-none focus:outline-none focus:border-accent focus:shadow-ring"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit(e as unknown as FormEvent);
            }
          }}
        />
        <Button type="submit" disabled={disabled || !text.trim()}>Send</Button>
      </div>
      <div className="text-xs text-text-subtle mt-1">Enter to send · Shift+Enter for newline</div>
    </form>
  );
}
