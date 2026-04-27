// 提供分校清單的 hook，根據登入者角色自動過濾。
// 學生 / 班級頁面用來組成下拉選單。

import { useEffect, useState } from 'react';

import { subscribeBranches } from '../services/branches';
import type { BranchDoc } from '../types/branch';
import { useAuth } from './useAuth';

interface UseBranchesResult {
  branches: BranchDoc[];
  loading: boolean;
  error: string | null;
}

export function useBranches(activeOnly = false): UseBranchesResult {
  const { user } = useAuth();
  const [all, setAll] = useState<BranchDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeBranches(
      (list) => {
        setAll(list);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  let branches = all;
  if (user && user.role !== 'hq_admin') {
    branches = branches.filter((b) => user.branchIds.includes(b.branchId));
  }
  if (activeOnly) branches = branches.filter((b) => b.status === 'active');

  return { branches, loading, error };
}
