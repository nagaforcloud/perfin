// ─── API client ───────────────────────────────────────────────────────────────

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const API_KEY = import.meta.env.VITE_API_KEY as string | undefined;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;

  const headers: Record<string, string> = {};

  // Only set Content-Type for JSON requests (browser sets it for FormData)
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  // Attach JWT auth token (from login) — takes priority over API key
  const jwtToken = localStorage.getItem('perfin_token');
  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  } else if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  // Merge caller-provided headers (they override defaults)
  if (options?.headers && typeof options.headers === 'object' && !(options.headers instanceof Headers)) {
    Object.assign(headers, options.headers as Record<string, string>);
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.error || body.message || msg;
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ─── Accounts ────────────────────────────────────────────────────────────────

import type {
  Account,
  Transaction,
  TransactionPage,
  TransactionFilters,
  MonthlyData,
  CategoryData,
  MerchantData,
  HealthScore,
  DashboardSummary,
  Anomaly,
  RecurringItem,
  CategoryBudget,
  DateRangeParams,
} from '@/lib/types';

export const Accounts = {
  list: () => request<Account[]>('/accounts'),
  create: (data: Partial<Account>) => request<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  update: (name: string, data: Partial<Account>) =>
    request<Account>(`/accounts/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (name: string) =>
    request<void>(`/accounts/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};

// ─── Transactions ─────────────────────────────────────────────────────────────

export const Transactions = {
  list: (filters: TransactionFilters = {}) =>
    request<TransactionPage>(`/transactions${qs(filters as Record<string, unknown>)}`),
  get: (id: number) => request<Transaction>(`/transactions/${id}`),
  update: (id: number, data: Partial<Transaction>) =>
    request<Transaction>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/transactions/${id}`, { method: 'DELETE' }),
  bulkDelete: (ids: number[]) =>
    request<void>('/transactions/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  categories: () => request<string[]>('/transactions/categories'),
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export const Analytics = {
  monthly: (params: DateRangeParams = {}) =>
    request<MonthlyData[]>(`/analytics/monthly${qs(params as Record<string, unknown>)}`),
  categories: (params: DateRangeParams = {}) =>
    request<CategoryData[]>(`/analytics/categories${qs(params as Record<string, unknown>)}`),
  merchants: (params: DateRangeParams & { top?: number } = {}) =>
    request<MerchantData[]>(`/analytics/merchants${qs(params as Record<string, unknown>)}`),
  health: () => request<HealthScore>('/analytics/health'),
  summary: (params: DateRangeParams = {}) =>
    request<DashboardSummary>(`/analytics/summary${qs(params as Record<string, unknown>)}`),
  anomalies: (params: DateRangeParams = {}) =>
    request<Anomaly[]>(`/analytics/anomalies${qs(params as Record<string, unknown>)}`),
  recurring: () => request<RecurringItem[]>('/analytics/recurring'),
  budgets: (params: DateRangeParams = {}) =>
    request<CategoryBudget[]>(`/budgets/status${qs(params as Record<string, unknown>)}`),
};

// ─── Budgets ──────────────────────────────────────────────────────────────────

import type { Budget } from '@/lib/types';

export const Budgets = {
  list: (account?: string) =>
    request<Budget[]>(`/budgets${account ? `?account=${encodeURIComponent(account)}` : ''}`),
  create: (data: { category: string; amount: number; period?: string; account?: string }) =>
    request<Budget>('/budgets', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<void>(`/budgets/${id}`, { method: 'DELETE' }),
};

// ─── Upload ───────────────────────────────────────────────────────────────────

export interface UploadResult {
  imported: number;
  skipped: number;
  errors: string[];
  account?: string;
  ocr_used?: boolean;
}

export const Upload = {
  statement: (file: File, account: string, bankHint?: string): Promise<UploadResult> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('account', account);
    if (bankHint) fd.append('bank_hint', bankHint);
    return request<UploadResult>('/upload', { method: 'POST', body: fd });
  },
};
