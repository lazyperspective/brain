"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAnima } from "@/lib/store";
import { MAX_LEN } from "@/lib/thoughts";
import { domRefs, uiRefs } from "@/lib/world";

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 1.1, ease: [0.16, 1, 0.3, 1] as const },
};

export function Overlay() {
  const thoughts = useAnima((s) => s.thoughts);
  const hovered = useAnima((s) => s.hovered);
  const submit = useAnima((s) => s.submit);

  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [collapsing, setCollapsing] = useState<{ text: string; key: number } | null>(
    null
  );
  const [showHint, setShowHint] = useState(true);
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 8000);
    return () => clearTimeout(t);
  }, []);

  const onSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = value.trim();
      if (!text) return;
      setValue("");
      setCollapsing({ text, key: ++seq.current });
      setShowHint(false);
      submit(text);
      window.setTimeout(() => setCollapsing(null), 700);
    },
    [value, submit]
  );

  const count = thoughts.length;

  return (
    <div className="overlay">
      <motion.header className="mark" {...fade}>
        <span className="wordmark">
          BRAIN
          <i className="pulse" aria-hidden />
        </span>
        <span className="byline">Pradeep Kapoor</span>
      </motion.header>

      <motion.div
        className="counter"
        {...fade}
        transition={{ ...fade.transition, delay: 0.15 }}
      >
        <motion.span
          key={count}
          initial={{ opacity: 0.3, filter: "blur(3px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          {count.toLocaleString()}
        </motion.span>
        <span className="counter-unit">thoughts</span>
      </motion.div>

      {/* Positioned every frame from the render loop, never from React. */}
      <div className="thought-label" ref={(el) => void (domRefs.label = el)}>
        <AnimatePresence>
          {hovered && (
            <motion.div
              key={hovered.id}
              className="thought-label-inner"
              initial={{ opacity: 0, scale: 0.92, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -2 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="thought-tick" aria-hidden />
              <span className="thought-text">{hovered.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="composer-wrap">
      <motion.form
        className={`composer${focused ? " is-focused" : ""}`}
        onSubmit={onSubmit}
        data-ui
        ref={(el) => void (uiRefs.composer = el)}
        {...fade}
        transition={{ ...fade.transition, delay: 0.3 }}
      >
        <div className="composer-field">
          <input
            ref={inputRef}
            className="composer-input"
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={(e) => {
              // Don't rely on implicit form submission — it is inconsistent
              // for a single-field form with no submit button.
              if (e.key === "Enter") {
                e.preventDefault();
                onSubmit();
              }
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="add a thought"
            aria-label="Add a thought to the collective"
            autoComplete="off"
            spellCheck={false}
            maxLength={MAX_LEN}
          />

          <AnimatePresence>
            {collapsing && (
              <motion.div
                key={collapsing.key}
                className="collapse-layer"
                aria-hidden
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {collapsing.text.split("").map((ch, i, arr) => {
                  // Letters converge on the centre from the outside in, so the
                  // sentence gathers into the single point the orb forms at.
                  const mid = (arr.length - 1) / 2;
                  const fromEdge = Math.abs(i - mid) / Math.max(mid, 1);
                  return (
                    <motion.span
                      key={i}
                      initial={{ x: 0, opacity: 1, scale: 1, filter: "blur(0px)" }}
                      animate={{
                        x: (mid - i) * 7,
                        opacity: 0,
                        scale: 0.3,
                        filter: "blur(4px)",
                      }}
                      transition={{
                        duration: 0.34,
                        delay: (1 - fromEdge) * 0.06,
                        ease: [0.7, 0, 0.3, 1],
                      }}
                    >
                      {ch === " " ? " " : ch}
                    </motion.span>
                  );
                })}
                <motion.i
                  className="seed"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.15, 0.2], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.5, delay: 0.16, ease: "easeOut" }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <span className="composer-rule" aria-hidden />
        <AnimatePresence>
          {value.length > MAX_LEN - 25 && (
            <motion.span
              className="composer-count"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
            >
              {MAX_LEN - value.length}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.form>
      </div>

      <AnimatePresence>
        {showHint && (
          <motion.p
            className="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, delay: 1.6 }}
          >
            drag to turn · scroll to move closer · hover a light to read it
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
