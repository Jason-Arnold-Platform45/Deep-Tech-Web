"use client";

import { useState, useEffect } from "react";

const LAST_VISITED_KEY = "deep-tech-pulse-last-visited";

export function useLastVisited() {
  const [lastVisited, setLastVisited] = useState<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem(LAST_VISITED_KEY);
    const previous = stored ? parseInt(stored, 10) : 0;
    setLastVisited(previous);
    // Update "last visited" to now so next visit knows when this one happened.
    localStorage.setItem(LAST_VISITED_KEY, Date.now().toString());
  }, []);

  /**
   * Returns true when the item was published after the previous visit.
   * On first visit, `lastVisited` is 0 so all content is considered new.
   */
  const isNew = (publishedAt: number): boolean => {
    if (lastVisited === 0) return true;
    return publishedAt > lastVisited;
  };

  return { lastVisited, isNew };
}
