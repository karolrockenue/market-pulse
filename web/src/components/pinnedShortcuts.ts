import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Radar,
  Trophy,
  FileText,
  DollarSign,
  Shield,
  TerminalSquare,
  BarChart3,
  ClipboardList,
  Globe,
  Zap,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const PINNED_MAX = 4;

export const VIEW_REGISTRY: Record<string, { label: string; icon: LucideIcon }> = {
  dashboard: { label: "Dashboard", icon: LayoutDashboard },
  demandRadar: { label: "Demand Radar", icon: Radar },
  "competitive-intel": { label: "Compset Intel", icon: Trophy },
  reports: { label: "Reports", icon: FileText },
  hotelRates: { label: "My Rates", icon: DollarSign },
  riskOverview: { label: "Risk Overview", icon: Shield },
  sentinel: { label: "Control Panel", icon: TerminalSquare },
  rateManager: { label: "Rate Manager", icon: DollarSign },
  marketProfile: { label: "Market Profile", icon: BarChart3 },
  crm: { label: "Task", icon: ClipboardList },
  distribution: { label: "Distribution", icon: Globe },
  channelPricing: { label: "Channel Pricing", icon: DollarSign },
  admin: { label: "Admin", icon: Zap },
  settings: { label: "Settings", icon: Settings },
};

export function isPinnable(view: string): boolean {
  return view in VIEW_REGISTRY;
}

const storageKey = (userKey: string) => `pinned_shortcuts_v1:${userKey}`;

function readPins(userKey: string): string[] {
  if (!userKey) return [];
  try {
    const raw = localStorage.getItem(storageKey(userKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => typeof v === "string" && isPinnable(v)).slice(0, PINNED_MAX);
  } catch {
    return [];
  }
}

function writePins(userKey: string, pins: string[]) {
  if (!userKey) return;
  try {
    localStorage.setItem(storageKey(userKey), JSON.stringify(pins));
  } catch {
    // storage quota / private mode — silently drop
  }
}

export interface UsePinnedShortcuts {
  pins: string[];
  pin: (view: string) => void;
  unpin: (view: string) => void;
  toggle: (view: string) => void;
  isPinned: (view: string) => boolean;
  canPin: boolean;
  max: number;
}

export function usePinnedShortcuts(userKey: string | null | undefined): UsePinnedShortcuts {
  const key = userKey || "";
  const [pins, setPins] = useState<string[]>(() => readPins(key));

  // Sync when user changes (login / switch)
  useEffect(() => {
    setPins(readPins(key));
  }, [key]);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(key)) {
        setPins(readPins(key));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const pin = useCallback(
    (view: string) => {
      if (!isPinnable(view)) return;
      setPins((prev) => {
        if (prev.includes(view)) return prev;
        if (prev.length >= PINNED_MAX) return prev;
        const next = [...prev, view];
        writePins(key, next);
        return next;
      });
    },
    [key]
  );

  const unpin = useCallback(
    (view: string) => {
      setPins((prev) => {
        if (!prev.includes(view)) return prev;
        const next = prev.filter((v) => v !== view);
        writePins(key, next);
        return next;
      });
    },
    [key]
  );

  const toggle = useCallback(
    (view: string) => {
      if (!isPinnable(view)) return;
      setPins((prev) => {
        if (prev.includes(view)) {
          const next = prev.filter((v) => v !== view);
          writePins(key, next);
          return next;
        }
        if (prev.length >= PINNED_MAX) return prev;
        const next = [...prev, view];
        writePins(key, next);
        return next;
      });
    },
    [key]
  );

  const isPinned = useCallback((view: string) => pins.includes(view), [pins]);
  const canPin = pins.length < PINNED_MAX;

  return { pins, pin, unpin, toggle, isPinned, canPin, max: PINNED_MAX };
}
