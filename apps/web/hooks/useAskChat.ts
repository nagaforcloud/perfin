'use client';

import { useChat } from 'ai/react';

export function useAskChat(threadId: number | null) {
  return useChat({
    api: '/api/ask/stream',
    body: threadId ? { threadId } : undefined,
    maxSteps: 5,
  });
}
