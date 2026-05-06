'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Message } from 'ai';
import { ThreadList } from '@/components/ask/ThreadList';
import { ChatBubble } from '@/components/ask/ChatBubble';
import { ToolCard } from '@/components/ask/ToolCard';
import { ProposalCard } from '@/components/ask/ProposalCard';
import { MessageComposer } from '@/components/ask/MessageComposer';
import { StarterPrompts } from '@/components/ask/StarterPrompts';
import { useAskChat } from '@/hooks/useAskChat';
import { apiFetch } from '@/lib/api';

interface PriorMessage {
  id: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  createdAt: string;
}

export default function AskPage() {
  return (
    <Suspense fallback={<div className="p-8 text-text-muted">Loading…</div>}>
      <AskPageInner />
    </Suspense>
  );
}

function AskPageInner() {
  const sp = useSearchParams();
  const queryThread = sp.get('thread');
  const [threadId, setThreadId] = useState<number | null>(queryThread ? Number(queryThread) : null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const { messages, append, isLoading, setMessages } = useAskChat(threadId);

  useEffect(() => {
    if (!threadId) { setMessages([]); setHistoryLoaded(true); return; }
    setHistoryLoaded(false);
    apiFetch<{ messages: PriorMessage[] }>(`/api/ask/threads/${threadId}`).then(({ messages: prior }) => {
      const seed: Message[] = prior
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ id: String(m.id), role: m.role as 'user' | 'assistant', content: m.content }));
      setMessages(seed);
      setHistoryLoaded(true);
    });
  }, [threadId, setMessages]);

  return (
    <div className="flex h-screen">
      <ThreadList activeId={threadId} />
      <main className="flex-1 flex flex-col p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Ask Perfin</h1>
        {historyLoaded && messages.length === 0 ? (
          <div className="space-y-4 flex-1">
            <p className="text-text-muted text-sm">Try one of these to get started:</p>
            <StarterPrompts onPick={(p) => append({ role: 'user', content: p })} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4">
            {messages.map((m) => (
              <div key={m.id} className="space-y-2">
                {m.toolInvocations?.map((ti) => {
                  if (ti.state === 'result' && isProposalResult(ti.result)) {
                    const r = ti.result as { proposalId: number; tool: string; preview: string };
                    return <ProposalCard key={ti.toolCallId} proposalId={r.proposalId} tool={r.tool} preview={r.preview} />;
                  }
                  return (
                    <ToolCard
                      key={ti.toolCallId}
                      toolName={ti.toolName}
                      status={ti.state === 'result' ? 'done' : 'running'}
                      summary={ti.state === 'result' ? summarize(ti.result) : undefined}
                    />
                  );
                })}
                {m.content && <ChatBubble role={m.role === 'user' ? 'user' : 'assistant'}>{m.content}</ChatBubble>}
              </div>
            ))}
          </div>
        )}
        <MessageComposer
          onSend={(text) => append({ role: 'user', content: text })}
          disabled={isLoading}
        />
      </main>
    </div>
  );

  function isProposalResult(v: unknown): boolean {
    return !!v && typeof v === 'object' && (v as { kind?: string }).kind === 'proposal';
  }
  function summarize(result: unknown): string | undefined {
    if (!result || typeof result !== 'object') return undefined;
    const r = result as Record<string, unknown>;
    if (typeof r.count === 'number')   return `${r.count} rows`;
    if (typeof r.merchant === 'string') return r.merchant as string;
    return undefined;
  }
}
