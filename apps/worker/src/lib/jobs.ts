import { EventEmitter } from 'node:events';

export type JobStatus = 'queued' | 'extracting' | 'categorizing' | 'inserting' | 'done' | 'failed';

export interface JobEvent {
  status: JobStatus;
  message?: string;
  extractedCount?: number;
  insertedCount?: number;
  error?: string;
}

interface JobState {
  id: number;
  events: JobEvent[];
  emitter: EventEmitter;
  done: boolean;
}

const jobs = new Map<number, JobState>();

export function createJob(id: number): void {
  jobs.set(id, { id, events: [], emitter: new EventEmitter(), done: false });
}

export function emit(id: number, event: JobEvent): void {
  const state = jobs.get(id);
  if (!state) return;
  state.events.push(event);
  state.emitter.emit('event', event);
  if (event.status === 'done' || event.status === 'failed') state.done = true;
}

export function subscribe(id: number, listener: (e: JobEvent) => void): () => void {
  const state = jobs.get(id);
  if (!state) return () => undefined;
  for (const evt of state.events) listener(evt);
  state.emitter.on('event', listener);
  return () => state.emitter.off('event', listener);
}

export function isDone(id: number): boolean {
  return jobs.get(id)?.done ?? false;
}
