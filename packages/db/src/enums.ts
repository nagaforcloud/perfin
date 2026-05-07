import { pgEnum } from 'drizzle-orm/pg-core';

export const planEnum = pgEnum('plan', ['free', 'plus', 'pro']);

export const connectionStatusEnum = pgEnum('connection_status', [
  'active', 'error', 'disconnected',
]);

export const anomalyStatusEnum = pgEnum('anomaly_status', [
  'open', 'confirmed', 'dismissed',
]);

export const insightSurfaceEnum = pgEnum('insight_surface', ['home', 'insights']);

export const uploadStatusEnum = pgEnum('upload_status', [
  'queued', 'extracting', 'categorizing', 'done', 'failed',
]);

export const recurringStatusEnum = pgEnum('recurring_status', [
  'active', 'cancelled', 'paused',
]);

export const goalStatusEnum = pgEnum('goal_status', [
  'active', 'reached', 'archived',
]);

export const inboundEmailStatusEnum = pgEnum('inbound_email_status', [
  'received', 'parsed', 'failed',
]);

export const proposalStatusEnum = pgEnum('proposal_status', [
  'pending', 'confirmed', 'cancelled',
]);

export const chatRoleEnum = pgEnum('chat_role', ['user', 'assistant', 'tool']);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid',
]);
