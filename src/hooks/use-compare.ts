import { useEffect, useState } from "react";

const STORAGE_KEY = "kubo-compare";

/** Comparing more than three side by side stops being readable on a laptop. */
export const COMPARE_LIMIT = 3;

/**
 * The compare shortlist.
 *
 * Unlike saved vehicles this is not tied to an account: comparing is something
 * a visitor does while browsing, often before they have signed up, so it lives
 * in this browser only. A module-level store keeps every card's button and the
 * header count in step without a provider.
 */
let ids: string[] = [];
let hydrated = false;
const listeners = new Set<(next: string[]) => void>();

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    // Private browsing or blocked storage — comparing still works for this view.
    return [];
  }
}

function write(next: string[]) {
  ids = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The list still applies for this visit; it just will not be remembered.
  }
  for (const listener of listeners) listener(next);
}

export type CompareState = {
  /** Empty until the browser store has been read, so SSR and hydration agree. */
  ids: string[];
  ready: boolean;
  has: (id: string) => boolean;
  toggle: (id: string) => { added: boolean; full: boolean };
  remove: (id: string) => void;
  clear: () => void;
};

export function useCompare(): CompareState {
  const [current, setCurrent] = useState<string[]>(ids);
  const [ready, setReady] = useState(hydrated);

  useEffect(() => {
    if (!hydrated) {
      ids = read();
      hydrated = true;
    }
    setCurrent(ids);
    setReady(true);

    listeners.add(setCurrent);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);

  return {
    ids: ready ? current : [],
    ready,
    has: (id) => current.includes(id),
    toggle: (id) => {
      if (current.includes(id)) {
        write(current.filter((value) => value !== id));
        return { added: false, full: false };
      }
      if (current.length >= COMPARE_LIMIT) return { added: false, full: true };
      write([...current, id]);
      return { added: true, full: false };
    },
    remove: (id) => write(current.filter((value) => value !== id)),
    clear: () => write([]),
  };
}
