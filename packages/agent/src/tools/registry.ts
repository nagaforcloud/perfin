import { ledgerQuery } from './ledger-query';
import { analyticsSummary } from './analytics-summary';
import { recurringDetect } from './recurring-detect';
import { anomaliesList } from './anomalies-list';
import { forecastCashflow } from './forecast-cashflow';
import { transactionUpdate } from './transaction-update';
import { transactionSplit } from './transaction-split';
import { budgetUpsert } from './budget-upsert';
import { goalCreate } from './goal-create';
import type { ToolContext } from './types';

export function buildTools(ctx: ToolContext) {
  return {
    ledgerQuery:        ledgerQuery(ctx),
    analyticsSummary:   analyticsSummary(ctx),
    recurringDetect:    recurringDetect(ctx),
    anomaliesList:      anomaliesList(ctx),
    forecastCashflow:   forecastCashflow(ctx),
    transactionUpdate:  transactionUpdate(ctx),
    transactionSplit:   transactionSplit(ctx),
    budgetUpsert:       budgetUpsert(ctx),
    goalCreate:         goalCreate(ctx),
  };
}

export const READ_TOOLS  = ['ledgerQuery', 'analyticsSummary', 'recurringDetect', 'anomaliesList', 'forecastCashflow'] as const;
export const WRITE_TOOLS = ['transactionUpdate', 'transactionSplit', 'budgetUpsert', 'goalCreate'] as const;
