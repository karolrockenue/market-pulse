import { useState, useEffect, useCallback } from "react";
import type { DistributionChannel } from "../api/types";
import * as api from "../api/distribution.api";

export function useChannels() {
  const [channels, setChannels] = useState<DistributionChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.fetchChannels();
      setChannels(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createChannel = useCallback(async (data: Partial<DistributionChannel>) => {
    const ch = await api.createChannel(data);
    await load();
    return ch;
  }, [load]);

  const updateChannel = useCallback(async (id: number, data: Partial<DistributionChannel>) => {
    const ch = await api.updateChannel(id, data);
    await load();
    return ch;
  }, [load]);

  const deleteChannel = useCallback(async (id: number) => {
    setChannels(prev => prev.filter(c => c.id !== id));
    try {
      await api.deleteChannel(id);
    } catch (err) {
      await load();
      throw err;
    }
  }, [load]);

  const addContact = useCallback(async (channelId: number, data: Parameters<typeof api.addContact>[1]) => {
    await api.addContact(channelId, data);
    await load();
  }, [load]);

  const updateContact = useCallback(async (id: number, data: Record<string, unknown>) => {
    await api.updateContact(id, data);
    await load();
  }, [load]);

  const deleteContact = useCallback(async (id: number) => {
    await api.deleteContact(id);
    await load();
  }, [load]);

  const addNote = useCallback(async (channelId: number, data: { author: string; body: string }) => {
    await api.addNote(channelId, data);
    await load();
  }, [load]);

  const deleteNote = useCallback(async (id: number) => {
    await api.deleteNote(id);
    await load();
  }, [load]);

  return { channels, loading, error, createChannel, updateChannel, deleteChannel, addContact, updateContact, deleteContact, addNote, deleteNote, refresh: load };
}
