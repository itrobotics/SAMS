// 集中所有「Firestore 即時同步」hook（Task 028）
//
// 目的：
//   1) 把 onSnapshot subscribe / unsubscribe 樣板抽出來，避免每個頁面寫一遍
//   2) 統一回傳 { data, loading, error } 介面，方便組件 render
//   3) 之後若要加 metric / log / 退避重試，只改這一處即可
//
// 約定：subscribe 函數須回傳 Unsubscribe，且接受 (onChange, onError) 兩個 callback
// — 這正是本專案 services/* 所有 subscribeXxx 採用的形狀。

import { useEffect, useRef, useState } from 'react';
import type { Unsubscribe } from 'firebase/firestore';

import {
  subscribeAttendanceForBranchDate,
  subscribeAttendanceForSession,
} from '../services/attendance';
import { subscribeSession, subscribeSessionsForBranchDate } from '../services/sessions';
import { subscribeCourseSessionsForBranchDate } from '../services/courseSessions';
import { subscribeCourseAttendanceForBranchDate } from '../services/courseAttendance';
import type { AttendanceRecordDoc } from '../types/attendance';
import type { SessionDoc } from '../types/session';
import type { CourseSessionDoc } from '../types/courseSession';
import type { CourseAttendanceDoc } from '../types/courseAttendance';

interface RealtimeState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

type SubscribeFn<T> = (
  onChange: (v: T) => void,
  onError?: (e: Error) => void,
) => Unsubscribe;

// 通用：給定一個 subscribe builder（依賴 deps 變動時重新訂閱），回傳統一狀態。
// builder 回傳 null 代表「目前條件不足，不要訂閱」。
function useRealtime<T>(
  builder: () => SubscribeFn<T> | null,
  initial: T,
  deps: React.DependencyList,
): RealtimeState<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 把 builder 放 ref，避免 lint 抱怨依賴
  const builderRef = useRef(builder);
  builderRef.current = builder;

  useEffect(() => {
    const subscribe = builderRef.current();
    if (!subscribe) {
      setData(initial);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = subscribe(
      (v) => {
        setData(v);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

// === 領域專用 wrapper ===

export function useSessionRealtime(sessionId: string | undefined) {
  return useRealtime<SessionDoc | null>(
    () => (sessionId ? (onChange, onError) => subscribeSession(sessionId, onChange, onError) : null),
    null,
    [sessionId],
  );
}

export function useSessionAttendanceRealtime(sessionId: string | undefined) {
  return useRealtime<AttendanceRecordDoc[]>(
    () => (sessionId ? (onChange, onError) => subscribeAttendanceForSession(sessionId, onChange, onError) : null),
    [],
    [sessionId],
  );
}

export function useBranchDaySessionsRealtime(branchId: string | undefined, date: string) {
  return useRealtime<SessionDoc[]>(
    () => (branchId
      ? (onChange, onError) => subscribeSessionsForBranchDate({ branchId, date }, onChange, onError)
      : null),
    [],
    [branchId, date],
  );
}

export function useBranchDayAttendanceRealtime(branchId: string | undefined, date: string) {
  return useRealtime<AttendanceRecordDoc[]>(
    () => (branchId
      ? (onChange, onError) => subscribeAttendanceForBranchDate(branchId, date, onChange, onError)
      : null),
    [],
    [branchId, date],
  );
}

// 學程：某分校某日的場次清單
export function useBranchDayCourseSessionsRealtime(branchId: string | undefined, date: string) {
  return useRealtime<CourseSessionDoc[]>(
    () => (branchId
      ? (onChange, onError) => subscribeCourseSessionsForBranchDate({ branchId, date }, onChange, onError)
      : null),
    [],
    [branchId, date],
  );
}

// 學程：某分校某日的出席紀錄
export function useBranchDayCourseAttendanceRealtime(branchId: string | undefined, date: string) {
  return useRealtime<CourseAttendanceDoc[]>(
    () => (branchId
      ? (onChange, onError) => subscribeCourseAttendanceForBranchDate(branchId, date, onChange, onError)
      : null),
    [],
    [branchId, date],
  );
}
