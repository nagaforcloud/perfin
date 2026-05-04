// ─── Core domain types ────────────────────────────────────────────────────────

export interface Account {
  name: string;
  bank?: string;
  account_type: 'checking' | 'savings' | 'credit' | 'investment' | 'other';
  currency?: string;
  color?: string;
  transaction_count?: number;
  total_income?: number;
  total_expenses?: number;
}

export interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  account?: string;
  merchant?: string;
  notes?: string;
  is_recurring?: boolean;
  tags?: string[];
}

export interface TransactionPage {
  transactions: Transaction[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface TransactionFilters {
  page?: number;
  per_page?: number;
  account?: string;
  category?: string;
  type?: 'income' | 'expense';
  search?: string;
  start_date?: string;
  end_date?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// ─── Analytics types ──────────────────────────────────────────────────────────

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CategoryData {
  category: string;
  total_income: number;
  total_expenses: number;
  count: number;
}

export interface MerchantData {
  merchant: string;
  total: number;
  count: number;
}

export interface HealthMetrics {
  savings_score: number;
  consistency_score: number;
  budget_score: number;
  categorization_score: number;
}

export interface HealthScore {
  total_score: number;
  max_score: number;
  rating: string;
  metrics?: HealthMetrics;
  summary?: {
    total_income: number;
    total_expenses: number;
    net_savings: number;
  };
}

export interface DashboardSummary {
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  transaction_count: number;
}

export interface Anomaly {
  id: number;
  date: string;
  description: string;
  amount: number;
  category?: string;
  account?: string;
  severity: 'critical' | 'medium' | 'low';
  reason?: string;
}

export interface RecurringItem {
  merchant: string;
  amount: number;
  frequency?: string;
  category?: string;
  last_date?: string;
  count?: number;
}

export interface CategoryBudget {
  category: string;
  spent: number;
  budget?: number;
}

export interface Budget {
  id: number;
  category: string;
  amount: number;
  period: 'monthly' | 'weekly' | 'yearly';
  account: string;
  created_at: string;
  updated_at: string;
}

// ─── API param types ──────────────────────────────────────────────────────────

export interface DateRangeParams {
  start_date?: string;
  end_date?: string;
  account?: string;
}
