"use client";

import type { DesignModel } from "./model";

export interface ScanSession {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  model: DesignModel;
}

const STORAGE_KEY = "vinyasa-sessions";
const MAX_SESSIONS = 20;
const MAX_BYTES = 3 * 1024 * 1024;

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
    if (typeof globalThis !== "undefined" && (globalThis as { localStorage?: Storage }).localStorage) {
      return (globalThis as { localStorage: Storage }).localStorage;
    }
  } catch {
    // ignore
  }
  return null;
}

function safeParse(raw: string): ScanSession[] | null {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

export function listSessions(): ScanSession[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? (safeParse(raw) ?? []) : [];
  } catch {
    return [];
  }
}

function writeSessions(list: ScanSession[]) {
  const storage = getStorage();
  if (!storage) return;
  try {
    const json = JSON.stringify(list);
    if (json.length > MAX_BYTES) {
      list = list.slice(0, Math.max(5, Math.floor(MAX_BYTES / json.length)));
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // quota exceeded - drop oldest
    try {
      const pruned = list.slice(list.length - 5);
      storage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch {
      // ignore
    }
  }
}

export function saveSession(model: DesignModel, name?: string): ScanSession {
  const list = listSessions();
  const now = new Date().toISOString();
  const session: ScanSession = {
    id: `scan-${Date.now()}`,
    name: name || model.source.title || model.source.url,
    url: model.source.url,
    createdAt: now,
    model,
  };
  const next = [session, ...list.filter((s) => s.url !== model.source.url)].slice(0, MAX_SESSIONS);
  writeSessions(next);
  return session;
}

export function deleteSession(id: string) {
  const list = listSessions().filter((s) => s.id !== id);
  writeSessions(list);
}

export function renameSession(id: string, name: string) {
  const list = listSessions().map((s) => (s.id === id ? { ...s, name } : s));
  writeSessions(list);
}

export function loadSession(id: string): ScanSession | null {
  return listSessions().find((s) => s.id === id) ?? null;
}

export function clearAllSessions() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}