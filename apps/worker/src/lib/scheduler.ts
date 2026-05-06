import cron from 'node-cron';

export interface SchedulerOptions {
  schedule: string;
  job: () => Promise<void> | void;
  disabled?: boolean;
}

export function startScheduler({ schedule, job, disabled }: SchedulerOptions): () => void {
  if (disabled) return () => undefined;
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron schedule: ${schedule}`);
  }
  const task = cron.schedule(schedule, () => { void job(); });
  return () => task.stop();
}
