import React, { createContext, useContext, useState, useEffect } from "react";

export interface ActionItem {
  id: number;
  name: string;
}

interface ActionListContextType {
  actionList: ActionItem[];
  toggleItem: (item: ActionItem) => void;
  removeItem: (id: number) => void;
  clearList: () => void;
  hasItem: (id: number) => boolean;
}

const ActionListContext = createContext<ActionListContextType | undefined>(
  undefined
);

export function ActionListProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [actionList, setActionList] = useState<ActionItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sentinel_action_list");
      if (saved) {
        setActionList(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load action list", e);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem("sentinel_action_list", JSON.stringify(actionList));
  }, [actionList]);

  const toggleItem = (item: ActionItem) => {
    setActionList((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) {
        return prev.filter((i) => i.id !== item.id);
      }
      return [...prev, item];
    });
  };

  const removeItem = (id: number) => {
    setActionList((prev) => prev.filter((i) => i.id !== id));
  };

  const clearList = () => setActionList([]);

  const hasItem = (id: number) => actionList.some((i) => i.id === id);

  return (
    <ActionListContext.Provider
      value={{ actionList, toggleItem, removeItem, clearList, hasItem }}
    >
      {children}
    </ActionListContext.Provider>
  );
}

export function useActionList() {
  const context = useContext(ActionListContext);
  if (!context) {
    throw new Error("useActionList must be used within an ActionListProvider");
  }
  return context;
}
