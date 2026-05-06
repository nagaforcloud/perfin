export const CATEGORIES = [
  'Income',
  'Food',
  'Groceries',
  'Transport',
  'Utilities',
  'Shopping',
  'Rent',
  'Insurance',
  'Subscription',
  'Investment',
  'Transfer',
  'Medical',
  'Entertainment',
  'Travel',
  'Education',
  'Professional Services',
  'Home Maintenance',
  'Personal Care',
  'Gifts & Donations',
  'Other',
  'Needs Review',
] as const;

export type Category = typeof CATEGORIES[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
