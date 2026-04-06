import { useState, useEffect, useCallback } from "react";
import type { CrmTask, TaskFilters } from "../api/types";
import * as api from "../api/distribution.api";

export function useCrmTasks(initialFilters?: TaskFilters) {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(initialFilters || {});

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.fetchTasks(filters);
      setTasks(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const createTask = useCallback(async (data: Parameters<typeof api.createTask>[0]) => {
    const task = await api.createTask(data);
    await load();
    return task;
  }, [load]);

  const updateTask = useCallback(async (id: number, data: Record<string, unknown>) => {
    // Optimistic update for status changes
    if (data.status) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: data.status as CrmTask["status"] } : t));
    }
    try {
      const updated = await api.updateTask(id, data);
      await load();
      return updated;
    } catch (err) {
      await load(); // Revert on error
      throw err;
    }
  }, [load]);

  const deleteTask = useCallback(async (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await api.deleteTask(id);
    } catch (err) {
      await load();
      throw err;
    }
  }, [load]);

  return { tasks, loading, error, filters, setFilters, createTask, updateTask, deleteTask, refresh: load };
}
