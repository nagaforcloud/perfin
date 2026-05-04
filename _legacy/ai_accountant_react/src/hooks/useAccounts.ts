import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Accounts } from '@/api/client';
import type { Account } from '@/lib/types';

export function useAccounts() {
  return useQuery({ queryKey: ['accounts'], queryFn: Accounts.list });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: Accounts.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: Partial<Account> }) =>
      Accounts.update(name, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: Accounts.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}
