"use client";

import * as React from "react";

type AnswerCueRuntime = {
  app: any;
  line: any;
  check: any;
  burst: any;
  startedAt: number;
};

export type AnswerCueValue = Readonly<{
  key: string;
  step: number;
}>;

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function clearRuntime(runtime: AnswerCueRuntime) {
  runtime.line.clear();
  runtime.check.clear();
  runtime.burst.clear();
}

/** Draws the source answer lock: line, check, and a small outward burst. */
function drawAnswerCue(runtime: AnswerCueRuntime, width: number, height: number, progress: number) {
  const eased = easeOutCubic(progress);
  const fade = progress < 0.76 ? 1 : Math.max(0, 1 - (progress - 0.76) / 0.24);
  const pad = 16;
  const y = height - 10;
  const lineWidth = Math.max(1, (width - pad * 2) * eased);

  runtime.line.clear();
  runtime.line.roundRect(pad, y, lineWidth, 3, 999);
  runtime.line.fill({ color: 0x1cb0f6, alpha: 0.9 * fade });

  if (progress < 0.42) {
    runtime.check.clear();
  } else {
    const local = Math.min(1, (progress - 0.42) / 0.28);
    const cx = width - pad - 12;
    const cy = y - 8;
    runtime.check.clear();
    runtime.check.circle(cx, cy, 8);
    runtime.check.fill({ color: 0x1cb0f6, alpha: 0.86 * fade });
    runtime.check.moveTo(cx - 4, cy);
    runtime.check.lineTo(cx - 1, cy + 3);
    runtime.check.lineTo(cx + 5, cy - 4);
    runtime.check.stroke({ width: 2, color: 0xffffff, alpha: local * fade });
  }

  runtime.burst.clear();
  const burstProgress = Math.min(1, Math.max(0, (progress - 0.16) / 0.46));
  if (burstProgress <= 0 || burstProgress >= 1) return;
  const burstFade = 1 - burstProgress;
  const originX = width / 2;
  const originY = Math.max(18, height * 0.52);
  const radius = 12 + burstProgress * Math.min(width, height) * 0.34;
  runtime.burst.circle(originX, originY, radius);
  runtime.burst.stroke({ width: 2, color: 0x1cb0f6, alpha: 0.22 * burstFade });
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2;
    runtime.burst.circle(originX + Math.cos(angle) * radius * 0.68, originY + Math.sin(angle) * radius * 0.38, 2.2);
    runtime.burst.fill({ color: 0xffffff, alpha: 0.42 * burstFade });
  }
}

/** Pixi answer confirmation kept independent from the question card layout. */
export function AnswerCue({ cue, reducedMotion, className }: { cue: AnswerCueValue | null; reducedMotion: boolean; className?: string }) {
  const mountRef = React.useRef<HTMLDivElement | null>(null);
  const runtimeRef = React.useRef<AnswerCueRuntime | null>(null);
  const lastCueKeyRef = React.useRef<string | null>(null);
  const [readyToken, setReadyToken] = React.useState(0);

  React.useEffect(() => {
    if (reducedMotion) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    const init = async () => {
      const root = mountRef.current;
      if (!root) return;
      try {
        const PIXI = await import("pixi.js");
        if (cancelled || !mountRef.current) return;
        const app = new PIXI.Application();
        await app.init({
          width: Math.max(root.clientWidth, 1),
          height: Math.max(root.clientHeight, 1),
          antialias: true,
          autoDensity: true,
          backgroundAlpha: 0,
          resolution: Math.min(Math.max(window.devicePixelRatio || 1, 1), 2),
        });
        if (cancelled || !mountRef.current) {
          app.destroy(true);
          return;
        }
        const line = new PIXI.Graphics();
        const check = new PIXI.Graphics();
        const burst = new PIXI.Graphics();
        app.stage.addChild(burst, line, check);
        const runtime: AnswerCueRuntime = { app, line, check, burst, startedAt: 0 };
        runtimeRef.current = runtime;
        root.appendChild(app.canvas);
        app.canvas.className = "muzluk-agent-questions__answer-cue-canvas";
        setReadyToken((token) => token + 1);
        const resize = () => app.renderer.resize(Math.max(root.clientWidth, 1), Math.max(root.clientHeight, 1));
        observer = new ResizeObserver(resize);
        observer.observe(root);
        resize();
        app.ticker.add(() => {
          const live = runtimeRef.current;
          if (!live || live.startedAt === 0) return;
          const age = Math.max(0, (performance.now() - live.startedAt) / 1000);
          const progress = Math.min(1, age / 0.32);
          if (progress >= 1) {
            clearRuntime(live);
            live.startedAt = 0;
            return;
          }
          drawAnswerCue(live, Math.max(root.clientWidth, 1), Math.max(root.clientHeight, 1), progress);
        });
      } catch {
        // The card and answer lock remain fully usable without a canvas renderer.
      }
    };
    void init();
    return () => {
      cancelled = true;
      observer?.disconnect();
      const runtime = runtimeRef.current;
      runtimeRef.current = null;
      runtime?.app?.destroy(true);
    };
  }, [reducedMotion]);

  React.useEffect(() => {
    if (!cue || reducedMotion) return;
    const runtime = runtimeRef.current;
    // The answer can land before Pixi finishes loading. Wait for the ready
    // token instead of dropping that confirmation cue on a cold mount.
    if (!runtime) return;
    if (lastCueKeyRef.current === cue.key && runtime.startedAt !== 0) return;
    lastCueKeyRef.current = cue.key;
    runtime.startedAt = performance.now();
  }, [cue, readyToken, reducedMotion]);

  if (reducedMotion) return null;
  return <div ref={mountRef} aria-hidden className={className} />;
}
