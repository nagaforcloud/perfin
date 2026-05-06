import { describe, expect, it } from 'vitest';
import {
  users, sessions, connections, accounts, transactions, budgets, goals,
  categoryRules, recurringSeries, anomalies, insights, agentActions,
  inboundEmails, uploadJobs,
  chatThreads, chatMessages, agentProposals,
  planEnum, connectionStatusEnum, anomalyStatusEnum, insightSurfaceEnum,
  uploadStatusEnum, recurringStatusEnum, goalStatusEnum, inboundEmailStatusEnum,
  proposalStatusEnum, chatRoleEnum,
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
});

// ... rest of existing schema tests ...
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
