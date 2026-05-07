import { describe, expect, it } from 'vitest';
import {
  users, sessions, connections, accounts, transactions, budgets, goals,
  categoryRules, recurringSeries, anomalies, insights, agentActions,
  inboundEmails, uploadJobs,
  chatThreads, chatMessages, agentProposals,
  subscriptions, pushSubscriptions,
  planEnum, connectionStatusEnum, anomalyStatusEnum, insightSurfaceEnum,
  uploadStatusEnum, recurringStatusEnum, goalStatusEnum, inboundEmailStatusEnum,
  proposalStatusEnum, chatRoleEnum, subscriptionStatusEnum,
} from '../src/schema/index';

describe('enums', () => {
  it('has plans', () => {
    expect(planEnum.enumValues).toEqual(['free', 'plus', 'pro']);
  });
  it('has connection statuses', () => {
    expect(connectionStatusEnum.enumValues).toEqual(['active', 'error', 'disconnected']);
  });
  it('has anomaly statuses', () => {
    expect(anomalyStatusEnum.enumValues).toEqual(['open', 'confirmed', 'dismissed']);
  });
  it('has insight surfaces', () => {
    expect(insightSurfaceEnum.enumValues).toEqual(['home', 'insights']);
  });
  it('has upload statuses', () => {
    expect(uploadStatusEnum.enumValues).toEqual(['queued', 'extracting', 'categorizing', 'done', 'failed']);
  });
  it('has recurring statuses', () => {
    expect(recurringStatusEnum.enumValues).toEqual(['active', 'cancelled', 'paused']);
  });
  it('has goal statuses', () => {
    expect(goalStatusEnum.enumValues).toEqual(['active', 'reached', 'archived']);
  });
  it('has inbound email statuses', () => {
    expect(inboundEmailStatusEnum.enumValues).toEqual(['received', 'parsed', 'failed']);
  });
  it('has proposal statuses', () => {
    expect(proposalStatusEnum.enumValues).toEqual(['pending', 'confirmed', 'cancelled']);
  });
  it('has chat roles', () => {
    expect(chatRoleEnum.enumValues).toEqual(['user', 'assistant', 'tool']);
  });
  it('has subscription statuses', () => {
    expect(subscriptionStatusEnum.enumValues).toEqual([
      'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid',
    ]);
  });
});

describe('chatThreads schema', () => {
  it('has expected columns', () => {
    expect(chatThreads.id).toBeDefined();
    expect(chatThreads.userId).toBeDefined();
    expect(chatThreads.title).toBeDefined();
    expect(chatThreads.pinned).toBeDefined();
  });
});

describe('chatMessages schema', () => {
  it('has expected columns', () => {
    expect(chatMessages.id).toBeDefined();
    expect(chatMessages.threadId).toBeDefined();
    expect(chatMessages.role).toBeDefined();
    expect(chatMessages.content).toBeDefined();
    expect(chatMessages.toolCalls).toBeDefined();
  });
});

describe('agentProposals schema', () => {
  it('has expected columns', () => {
    expect(agentProposals.id).toBeDefined();
    expect(agentProposals.userId).toBeDefined();
    expect(agentProposals.threadId).toBeDefined();
    expect(agentProposals.tool).toBeDefined();
    expect(agentProposals.input).toBeDefined();
    expect(agentProposals.preview).toBeDefined();
    expect(agentProposals.status).toBeDefined();
  });
});

describe('users.stripe_customer_id column added', () => {
  it('exposes stripeCustomerId', () => {
    expect(users.stripeCustomerId).toBeDefined();
  });
});

describe('subscriptions schema', () => {
  it('has expected columns', () => {
    expect(subscriptions.userId).toBeDefined();
    expect(subscriptions.stripeSubscriptionId).toBeDefined();
    expect(subscriptions.stripePriceId).toBeDefined();
    expect(subscriptions.plan).toBeDefined();
    expect(subscriptions.status).toBeDefined();
    expect(subscriptions.currentPeriodEnd).toBeDefined();
  });
});

describe('pushSubscriptions schema', () => {
  it('has endpoint, p256dh, auth', () => {
    expect(pushSubscriptions.endpoint).toBeDefined();
    expect(pushSubscriptions.p256dh).toBeDefined();
    expect(pushSubscriptions.auth).toBeDefined();
  });
});
