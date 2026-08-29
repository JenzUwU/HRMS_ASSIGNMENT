"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
} from "@heroicons/react/24/solid";
import { Logo } from "@/components/layout/Logo";

/**
 * Liquid-gradient login background: soft orange pigment drifting through milk.
 * Canvas 2D, no dependencies. Decorative only — aria-hidden, pointer-events off.
 */
function LiquidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame = 0;
    let width = 0;
    let height = 0;

    const measure = () => {
      // Prefer the canvas's own laid-out box; fall back to the viewport.
      const rect = canvas.getBoundingClientRect();
      const w =
        rect.width ||
        window.innerWidth ||
        document.documentElement.clientWidth ||
        0;
      const h =
        rect.height ||
        window.innerHeight ||
        document.documentElement.clientHeight ||
        0;
      return { w: Math.round(w), h: Math.round(h) };
    };

    const resize = () => {
      const { w, h } = measure();
      if (w === 0 || h === 0) return; // not laid out yet — try again next frame
      if (w === width && h === height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = w;
      height = h;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Pointer trail. Adapted from the reference TouchTexture: each mouse move
    // drops a point carrying the direction of travel (vx, vy) and a force from
    // how fast the pointer moved. Points age out over MAX_AGE frames and keep
    // drifting along their own velocity, so pigment flows along the path the
    // cursor took and then settles. Continuous motion does not depend on it.
    const MAX_AGE = 62;
    const TRAIL_MAX = 24;
    type TrailPoint = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      force: number;
      age: number;
    };
    const trail: TrailPoint[] = [];
    let last: { x: number; y: number } | null = null;

    const addPoint = (nx: number, ny: number) => {
      let vx = 0;
      let vy = 0;
      let force = 0;
      if (last) {
        const dx = nx - last.x;
        const dy = ny - last.y;
        const dd = dx * dx + dy * dy;
        if (dd === 0) return;
        const d = Math.sqrt(dd);
        vx = dx / d;
        vy = dy / d;
        force = Math.min(dd * 12000, 1.6);
      }
      last = { x: nx, y: ny };
      trail.push({ x: nx, y: ny, vx, vy, force, age: 0 });
      if (trail.length > TRAIL_MAX) trail.shift();
    };

    const onMove = (e: MouseEvent) => {
      addPoint(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
    };
    const onLeave = () => {
      last = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);

    const updateTrail = () => {
      const speed = 1 / MAX_AGE;
      for (let i = trail.length - 1; i >= 0; i--) {
        const p = trail[i];
        const f = p.force * speed * (1 - p.age / MAX_AGE);
        p.x += p.vx * f;
        p.y += p.vy * f;
        p.age += 1;
        if (p.age >= MAX_AGE) trail.splice(i, 1);
      }
    };

    // Brand orange #F15A22 -> rgb(241, 90, 34), kept faint so the mix reads
    // ~85% milky white / ~15% soft orange. Each blob is drawn as a few
    // offset lobes whose spacing oscillates -> organic morphing, not a circle.
    const blobs = [
      { x: 0.2, y: 0.24, size: 0.4, speed: 0.0016, phase: 0.0, opacity: 0.16, pull: 0.05 },
      { x: 0.8, y: 0.26, size: 0.36, speed: 0.0013, phase: 2.1, opacity: 0.12, pull: -0.04 },
      { x: 0.7, y: 0.8, size: 0.46, speed: 0.0014, phase: 4.0, opacity: 0.13, pull: 0.06 },
      { x: 0.26, y: 0.78, size: 0.34, speed: 0.0019, phase: 5.2, opacity: 0.1, pull: -0.05 },
    ];

    const drawLobe = (
      x: number,
      y: number,
      radius: number,
      opacity: number,
    ) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, `rgba(241, 90, 34, ${opacity})`);
      g.addColorStop(0.35, `rgba(245, 133, 91, ${opacity * 0.55})`);
      g.addColorStop(0.7, `rgba(255, 190, 160, ${opacity * 0.18})`);
      g.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const paint = (time: number) => {
      const t = time * 0.001;
      updateTrail();

      ctx.clearRect(0, 0, width, height);

      const base = ctx.createLinearGradient(0, 0, width, height);
      base.addColorStop(0, "#FFFDF9");
      base.addColorStop(0.35, "#FFFCF7");
      base.addColorStop(0.7, "#FFFDFC");
      base.addColorStop(1, "#FAF8F4");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      const minDim = Math.min(width, height);
      ctx.globalCompositeOperation = "multiply";

      blobs.forEach((blob, i) => {
        const s = blob.speed * 1000; // per-second angular rate
        // Large continuous drift.
        let cx =
          width * blob.x + Math.sin(t * s + blob.phase) * width * 0.22;
        let cy =
          height * blob.y +
          Math.cos(t * s * 0.82 + blob.phase * 1.3) * height * 0.2;

        // Pointer trail: sum the flow from every still-living trail point near
        // this blob. Each pushes the pigment along the direction the cursor was
        // travelling, scaled by force, proximity, and remaining life.
        const reach = minDim * 0.28;
        let swell = 0;
        for (let k = 0; k < trail.length; k++) {
          const p = trail[k];
          const ddx = cx - p.x * width;
          const ddy = cy - p.y * height;
          const d = Math.hypot(ddx, ddy);
          if (d > reach) continue;
          const fall = 1 - d / reach;
          const life = 1 - p.age / MAX_AGE;
          const push = fall * fall * life * p.force * blob.pull * minDim * 7;
          cx += p.vx * push;
          cy += p.vy * push;
          swell += fall * life * p.force * 0.04;
        }

        const baseR = minDim * blob.size * (1 + Math.min(swell, 0.18));
        // Breathing radius so the mass pulses.
        const breathe = 1 + Math.sin(t * (s * 0.7) + blob.phase) * 0.12;

        // 3 lobes with oscillating offsets -> morphing, non-circular shape.
        for (let l = 0; l < 3; l++) {
          const a = t * (s * 0.6) + blob.phase + (l * Math.PI * 2) / 3;
          const spread = baseR * (0.16 + 0.12 * Math.sin(t * s * 0.5 + l + i));
          drawLobe(
            cx + Math.cos(a) * spread,
            cy + Math.sin(a * 1.1) * spread,
            baseR * breathe * (0.72 - l * 0.12),
            blob.opacity * (1 - l * 0.18),
          );
        }
      });

      ctx.globalCompositeOperation = "source-over";
    };

    // Now that paint() exists, wire up sizing and do the first measure.
    window.addEventListener("resize", resize);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const cleanup = () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };

    const render = (time: number) => {
      if (width === 0) resize();
      paint(time);
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);

    return cleanup;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("admin@hrms.com");
  const [password, setPassword] = useState("password");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FFFDF9] px-4">
      <LiquidBackground />

      <div className="relative z-10 w-full max-w-lg rounded-3xl bg-surface/95 p-10 shadow-[0_20px_60px_rgba(41,41,41,0.12)] ring-1 ring-border/60 backdrop-blur-sm">
        <div className="flex flex-col items-center pt-6 text-center">
          <Logo size={80} />
          <p className="mt-4 font-heading text-lg font-medium text-[#9A5A30]">
            Post Offer Engagement
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-charcoal">
            HRMS
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Sign in to access your account
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label className="text-sm font-semibold text-charcoal">
              Email ID
            </label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border px-3 py-3 focus-within:border-orange">
              <EnvelopeIcon className="h-5 w-5 text-text-secondary" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email ID"
                className="w-full bg-transparent text-sm outline-none placeholder:text-text-secondary"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-charcoal">
              Password
            </label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border px-3 py-3 focus-within:border-orange">
              <LockClosedIcon className="h-5 w-5 text-text-secondary" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-transparent text-sm outline-none placeholder:text-text-secondary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="text-text-secondary"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            <div className="mt-2 text-right">
              <button type="button" className="text-sm font-semibold text-orange">
                Forgot Password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-orange py-3.5 text-sm font-semibold text-white transition-colors hover:bg-orange/90"
          >
            Login
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-text-secondary">
          2026 HRMS. All rights reserved.
        </p>
      </div>
    </div>
  );
}
