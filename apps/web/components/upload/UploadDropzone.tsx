'use client';

import { useState, useRef } from 'react';
import { Button, cn } from '@perfin/ui';

interface Props {
  onUploaded: (uploadJobId: number) => void;
}

export function UploadDropzone({ onUploaded }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      const { uploadJobId } = (await res.json()) as { uploadJobId: number };
      onUploaded(uploadJobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void send(f);
      }}
      className={cn(
        'border-2 border-dashed rounded-xl p-12 text-center',
        'transition-colors duration-[120ms] cursor-pointer',
        dragOver ? 'border-accent bg-accent-soft' : 'border-border-strong bg-surface',
      )}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); }}
      />
      <p className="text-text font-medium">Drop a CSV, Excel, or PDF here</p>
      <p className="text-text-muted text-sm mt-1">or click to choose a file (max 10 MB)</p>
      <Button className="mt-4" variant="secondary" disabled={busy}>
        {busy ? 'Uploading…' : 'Choose file'}
      </Button>
      {error && <p className="text-negative text-sm mt-3">{error}</p>}
    </div>
  );
}
