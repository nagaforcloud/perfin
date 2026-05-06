'use client';

import { Tile } from '@perfin/ui';
import { STARTER_PROMPTS } from '@/lib/starter-prompts';

export function StarterPrompts({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {STARTER_PROMPTS.map((p) => (
        <button key={p} type="button" onClick={() => onPick(p)} className="text-left">
          <Tile className="hover:bg-surface-2 transition-colors duration-[120ms]">
            <span className="text-sm">{p}</span>
          </Tile>
        </button>
      ))}
    </div>
  );
}
