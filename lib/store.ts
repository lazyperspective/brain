"use client";

import { create } from "zustand";
import {
  loadThoughts,
  makeThought,
  persistOwn,
  type Thought,
} from "./thoughts";

type HoverInfo = { id: string; text: string; x: number; y: number } | null;

type State = {
  thoughts: Thought[];
  ready: boolean;
  hovered: HoverInfo;
  /** Incremented on submit; the scene watches this to launch an orb. */
  pending: { id: string; text: string; seq: number } | null;
  init: () => void;
  submit: (text: string) => void;
  setHovered: (h: HoverInfo) => void;
  clearPending: () => void;
};

let seq = 0;

export const useAnima = create<State>((set, get) => ({
  thoughts: [],
  ready: false,
  hovered: null,
  pending: null,

  init: () => {
    if (get().ready) return;
    set({ thoughts: loadThoughts(), ready: true });
  },

  submit: (text: string) => {
    const clean = text.trim().replace(/\s+/g, " ");
    if (!clean) return;
    const t = makeThought(clean);
    const next = get().thoughts.concat(t);
    persistOwn(next);
    set({
      thoughts: next,
      pending: { id: t.id, text: t.text, seq: ++seq },
    });
  },

  setHovered: (hovered) => {
    const cur = get().hovered;
    if (cur?.id === hovered?.id && cur && hovered) {
      // Same node — only the label position moved; avoid a store write per frame.
      if (Math.abs(cur.x - hovered.x) < 1 && Math.abs(cur.y - hovered.y) < 1) return;
    }
    set({ hovered });
  },

  clearPending: () => set({ pending: null }),
}));
