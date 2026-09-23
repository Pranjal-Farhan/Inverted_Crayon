"use client";

const KEY = "ic_recently_viewed_v1";
const MAX = 10;

export function trackRecentlyViewed(productId: string) {
  try {
    const raw = window.localStorage.getItem(KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const next = [productId, ...ids.filter((id) => id !== productId)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — recently-viewed just won't persist
  }
}

export function getRecentlyViewed(excludeId?: string): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    return ids.filter((id) => id !== excludeId);
  } catch {
    return [];
  }
}
