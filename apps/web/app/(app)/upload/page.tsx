'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tile, Badge } from '@perfin/ui';
import { UploadDropzone } from '@/components/upload/UploadDropzone';

interface JobEvent {
  status: 'queued' | 'extracting' | 'categorizing' | 'inserting' | 'done' | 'failed';
  message?: string;
  extractedCount?: number;
  insertedCount?: number;
  error?: string;
}

const WORKER_BASE = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8001';

export default function UploadPage() {
  const router = useRouter();
  const [jobId, setJobId] = useState<number | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);

  useEffect(() => {
    if (jobId == null) return;
    const es = new EventSource(`${WORKER_BASE}/jobs/${jobId}/stream`);
    es.onmessage = (m) => {
      const data = JSON.parse(m.data) as JobEvent;
      setEvents((prev) => [...prev, data]);
      if (data.status === 'done') setTimeout(() => router.push('/app/transactions'), 1200);
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [jobId, router]);

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Upload statement</h1>
      {jobId == null
        ? <UploadDropzone onUploaded={setJobId} />
        : (
          <Tile variant="raised" className="space-y-2">
            <p className="font-medium">Processing job #{jobId}…</p>
            {events.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Badge variant={e.status === 'failed' ? 'expense' : e.status === 'done' ? 'income' : 'info'}>
                  {e.status}
                </Badge>
                {e.extractedCount !== undefined && <span>extracted {e.extractedCount}</span>}
                {e.insertedCount  !== undefined && <span>inserted {e.insertedCount}</span>}
                {e.error && <span className="text-negative">{e.error}</span>}
              </div>
            ))}
          </Tile>
        )}
    </div>
  );
}
