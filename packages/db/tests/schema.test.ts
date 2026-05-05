import { describe, expect, it } from 'vitest';
import {
  users, sessions, connections, accounts, transactions, budgets, goals,
  categoryRules, recurringSeries, anomalies, insights, agentActions,
  inboundEmails, uploadJobs,
  planEnum, connectionStatusEnum, anomalyStatusEnum, insightSurfaceEnum,
  uploadStatusEnum, recurringStatusEnum, goalStatusEnum, inboundEmailStatusEnum,
} from '../src/schema/index.js';

describe('enums', () => {
  it('plan enum has free/plus/pro', () => {
    expect(planEnum.enumValues).toEqual(['free', 'plus', 'pro']);
  });
  it('connection status enum', () => {
    expect(connectionStatusEnum.enumValues).toEqual(['active', 'error', 'disconnected']);
  });
  it('anomaly status enum', () => {
    expect(anomalyStatusEnum.enumValues).toEqual(['open', 'confirmed', 'dismissed']);
  });
  it('insight surface enum', () => {
    expect(insightSurfaceEnum.enumValues).toEqual(['home', 'insights']);
  });
  it('upload status enum', () => {
    expect(uploadStatusEnum.enumValues)
      .toEqual(['queued', 'extracting', 'categorizing', 'done', 'failed']);
  });
  it('recurring status enum', () => {
    expect(recurringStatusEnum.enumValues).toEqual(['active', 'cancelled', 'paused']);
  });
  it('goal status enum', () => {
    expect(goalStatusEnum.enumValues).toEqual(['active', 'reached', 'archived']);
  });
  it('inbound email status enum', () => {
    expect(inboundEmailStatusEnum.enumValues).toEqual(['received', 'parsed', 'failed']);
  });
});

describe('users schema', () => {
  it('has expected columns', () => {
    expect(users.id).toBeDefined();
    expect(users.email).toBeDefined();
    expect(users.passwordHash).toBeDefined();
    expect(users.plan).toBeDefined();
    expect(users.createdAt).toBeDefined();
  });
});

describe('sessions schema', () => {
  it('has expected columns', () => {
    expect(sessions.id).toBeDefined();
    expect(sessions.userId).toBeDefined();
    expect(sessions.tokenHash).toBeDefined();
    expect(sessions.expiresAt).toBeDefined();
  });
});

describe('connections schema', () => {
  it('has expected columns', () => {
    expect(connections.id).toBeDefined();
    expect(connections.userId).toBeDefined();
    expect(connections.provider).toBeDefined();
    expect(connections.accessTokenEnc).toBeDefined();
    expect(connections.cursor).toBeDefined();
    expect(connections.status).toBeDefined();
  });
});

describe('accounts schema', () => {
  it('has expected columns', () => {
    expect(accounts.id).toBeDefined();
    expect(accounts.userId).toBeDefined();
    expect(accounts.connectionId).toBeDefined();
    expect(accounts.balanceCents).toBeDefined();
    expect(accounts.currency).toBeDefined();
  });
});

describe('transactions schema', () => {
  it('has expected columns including parent for splits', () => {
    expect(transactions.id).toBeDefined();
    expect(transactions.amountCents).toBeDefined();
    expect(transactions.parentTransactionId).toBeDefined();
    expect(transactions.tags).toBeDefined();
    expect(transactions.pending).toBeDefined();
    expect(transactions.rawDescription).toBeDefined();
    expect(transactions.plaidTxnId).toBeDefined();
  });
});

describe('budgets schema', () => {
  it('has period and amount', () => {
    expect(budgets.period).toBeDefined();
    expect(budgets.amountCents).toBeDefined();
  });
});

describe('goals schema', () => {
  it('has target/saved cents and status', () => {
    expect(goals.targetCents).toBeDefined();
    expect(goals.savedCents).toBeDefined();
    expect(goals.status).toBeDefined();
  });
});

describe('categoryRules schema', () => {
  it('has priority/pattern/matchType', () => {
    expect(categoryRules.priority).toBeDefined();
    expect(categoryRules.pattern).toBeDefined();
    expect(categoryRules.matchType).toBeDefined();
  });
});

describe('recurringSeries schema', () => {
  it('has cadence, confidence, status', () => {
    expect(recurringSeries.cadence).toBeDefined();
    expect(recurringSeries.confidence).toBeDefined();
    expect(recurringSeries.status).toBeDefined();
  });
});

describe('anomalies schema', () => {
  it('has score, kind, status', () => {
    expect(anomalies.score).toBeDefined();
    expect(anomalies.kind).toBeDefined();
    expect(anomalies.status).toBeDefined();
  });
});

describe('insights schema', () => {
  it('has surface, confidence, payload', () => {
    expect(insights.surface).toBeDefined();
    expect(insights.confidence).toBeDefined();
    expect(insights.payload).toBeDefined();
  });
});

describe('agentActions schema', () => {
  it('has tool/input/output and audit fields', () => {
    expect(agentActions.tool).toBeDefined();
    expect(agentActions.input).toBeDefined();
    expect(agentActions.output).toBeDefined();
    expect(agentActions.confirmedAt).toBeDefined();
    expect(agentActions.undoneAt).toBeDefined();
  });
});

describe('inboundEmails schema', () => {
  it('has from, bodyHash, status', () => {
    expect(inboundEmails.from).toBeDefined();
    expect(inboundEmails.bodyHash).toBeDefined();
    expect(inboundEmails.status).toBeDefined();
  });
});

describe('uploadJobs schema', () => {
  it('has fileName, mime, status, extractedCount', () => {
    expect(uploadJobs.fileName).toBeDefined();
    expect(uploadJobs.mime).toBeDefined();
    expect(uploadJobs.status).toBeDefined();
    expect(uploadJobs.extractedCount).toBeDefined();
  });
});
