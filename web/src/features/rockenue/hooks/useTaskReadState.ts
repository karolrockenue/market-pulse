import { useCallback, useEffect, useRef, useState } from "react";
import type { CrmTask } from "../api/types";

// Per-user, per-device read state for CRM tasks.
// Key: task id. Value: ISO timestamp of the task's updated_at at the moment
// the user last opened it. A task is unread when its current updated_at is
// newer than this timestamp.
//
// On first run, we seed every currently-visible task with "now" so the user
// doesn't see a wall of unread indicators for pre-existing tasks. Only
// future changes will trigger the dot.

const STORAGE_KEY = "mp.crm.taskReadState.v1";
const INIT_FLAG_KEY = "mp.crm.taskReadState.v1.seeded";

type ReadMap = Record<number, string>;

function loadMap(): ReadMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as ReadMap : {};
  } catch {
    return {};
  }
}

function saveMap(map: ReadMap) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch { /* quota */ }
}

export function useTaskReadState(tasks: CrmTask[]) {
  const [map, setMap] = useState<ReadMap>(() => loadMap());
  const seededRef = useRef<boolean>(false);

  // First-run baseline: mark every existing task as read so we don't flood the
  // user with unread dots the first time this feature ships.
  useEffect(() => {
    if (seededRef.current) return;
    if (tasks.length === 0) return;
    const alreadySeeded = localStorage.getItem(INIT_FLAG_KEY) === "1";
    if (alreadySeeded) { seededRef.current = true; return; }

    const now = new Date().toISOString();
    const next: ReadMap = { ...map };
    for (const t of tasks) {
      if (next[t.id] == null) next[t.id] = now;
    }
    setMap(next);
    saveMap(next);
    try { localStorage.setItem(INIT_FLAG_KEY, "1"); } catch { /* quota */ }
    seededRef.current = true;
  }, [tasks, map]);

  const isUnread = useCallback((task: CrmTask): boolean => {
    const seenAt = map[task.id];
    if (!seenAt) return true;
    return task.updated_at > seenAt;
  }, [map]);

  const markRead = useCallback((taskId: number, updatedAt?: string) => {
    setMap(prev => {
      const stamp = updatedAt ?? new Date().toISOString();
      if (prev[taskId] === stamp) return prev;
      const next = { ...prev, [taskId]: stamp };
      saveMap(next);
      return next;
    });
  }, []);

  return { isUnread, markRead };
}
