import {
  pgTable, serial, integer, text, bigint, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { uploadStatusEnum } from '../enums';

export const uploadJobs = pgTable(
  'upload_jobs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    status: uploadStatusEnum('status').notNull().default('queued'),
    extractedCount: integer('extracted_count').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userStatusIdx: index('upload_jobs_user_status_idx').on(t.userId, t.status),
  }),
);

export type UploadJob = typeof uploadJobs.$inferSelect;
export type NewUploadJob = typeof uploadJobs.$inferInsert;
