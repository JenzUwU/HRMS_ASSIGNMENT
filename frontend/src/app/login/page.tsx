"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
} from "@heroicons/react/24/solid";
import { Logo } from "@/components/layout/Logo";

/**
 * TouchTexture — a small offscreen canvas that records the pointer's recent
 * path as a decaying velocity field, uploaded to the GPU each frame. Ported
 * from the reference implementation; used only to distort the gradient near
 * the cursor.
 */
class TouchTexture {
  size = 64;
  maxAge = 64;
  radius = 0.15 * 64;
  speed = 1 / 64;
  trail: {
    x: number;
    y: number;
    age: number;
    force: number;
    vx: number;
    vy: number;
  }[] = [];
  last: { x: number; y: number } | null = null;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = this.size;
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.size, this.size);
    this.texture = new THREE.CanvasTexture(this.canvas);
  }

  addTouch(point: { x: number; y: number }) {
    let force = 0;
    let vx = 0;
    let vy = 0;
    const last = this.last;
    if (last) {
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (dx === 0 && dy === 0) return;
      const dd = dx * dx + dy * dy;
      const d = Math.sqrt(dd);
      vx = dx / d;
      vy = dy / d;
      force = Math.min(dd * 10000, 1.4);
    }
    this.last = { x: point.x, y: point.y };
    this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
  }

  update() {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.size, this.size);

    for (let i = this.trail.length - 1; i >= 0; i--) {
      const point = this.trail[i];
      const f = point.force * this.speed * (1 - point.age / this.maxAge);
      point.x += point.vx * f;
      point.y += point.vy * f;
      point.age++;
      if (point.age > this.maxAge) {
        this.trail.splice(i, 1);
      } else {
        this.drawPoint(point);
      }
    }
    this.texture.needsUpdate = true;
  }

  drawPoint(point: {
    x: number;
    y: number;
    age: number;
    force: number;
    vx: number;
    vy: number;
  }) {
    const pos = { x: point.x * this.size, y: (1 - point.y) * this.size };

    let intensity = 1;
    if (point.age < this.maxAge * 0.3) {
      intensity = Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2));
    } else {
      const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
      intensity = -t * (t - 2);
    }
    intensity *= point.force;

    const radius = this.radius;
    const color = `${((point.vx + 1) / 2) * 255}, ${
      ((point.vy + 1) / 2) * 255
    }, ${intensity * 255}`;
    const offset = this.size * 5;
    this.ctx.shadowOffsetX = offset;
    this.ctx.shadowOffsetY = offset;
    this.ctx.shadowBlur = radius;
    this.ctx.shadowColor = `rgba(${color},${0.22 * intensity})`;

    this.ctx.beginPath();
    this.ctx.fillStyle = "rgba(255,0,0,1)";
    this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

/**
 * Liquid-gradient login background: soft Swiggy-orange pigment flowing through
 * milky white. WebGL (three.js). Decorative only — aria-hidden, pointer-events
 * off. Pointer movement distorts the pigment along the path of travel via
 * TouchTexture; the drift underneath is continuous regardless of the pointer.
 *
 * Palette is intentionally milk-dominant (~85% #FFFDF9 base, orange tops out
 * around 0.17 mix) — orange reads as pigment suspended in milk, not a wash.
 */
const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform sampler2D uTouch;
  uniform vec3 uMilk;
  uniform vec3 uOrange;
  uniform vec3 uOrangeSoft;

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);

    // Pointer trail: shove the pigment along the direction the cursor moved,
    // then a soft ripple radiating from screen centre, both scaled by the
    // decaying touch intensity.
    vec4 tt = texture2D(uTouch, uv);
    float vx = tt.r * 2.0 - 1.0;
    float vy = tt.g * 2.0 - 1.0;
    float inten = tt.b;
    uv += vec2(vx, vy) * 0.20 * inten;
    float dCen = length((uv - 0.5) * vec2(aspect, 1.0));
    uv += sin(dCen * 16.0 - uTime * 2.4) * 0.012 * inten;

    // Sum of drifting soft radial centres -> one organic, morphing mass.
    float field = 0.0;
    float warm = 0.0;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      // Home position spread around the frame (not all near centre) so the
      // pigment reads as flowing streaks, not a central spotlight.
      vec2 home = vec2(
        0.5 + cos(fi * 2.3944) * 0.42,
        0.5 + sin(fi * 2.3944) * 0.42
      );
      vec2 c = home + vec2(
        sin(uTime * 0.19 + fi * 1.7) * 0.16,
        cos(uTime * 0.15 + fi * 2.3) * 0.16
      );
      float d = length((uv - c) * vec2(aspect, 1.0));
      float infl = smoothstep(0.46, 0.0, d) * (0.55 + 0.45 * sin(uTime * 0.5 + fi));
      field += infl;
      warm += infl * (0.5 + 0.5 * sin(uTime * 0.3 + fi * 2.0));
    }
    field = clamp(field, 0.0, 1.0);
    warm = clamp(warm / max(field, 0.001), 0.0, 1.0);

    // Milk stays dominant: pigment maxes ~0.12, plus a touch more at the cursor.
    float pigment = field * 0.12 + inten * 0.05;
    vec3 orange = mix(uOrangeSoft, uOrange, warm);
    vec3 col = mix(uMilk, orange, pigment);

    // Fine grain so the gradient never bands.
    float g = fract(sin(dot(uv * uResolution, vec2(12.9898, 78.233))) * 43758.5453);
    col += (g - 0.5) * 0.012;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function LiquidBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let width = 0;
    let height = 0;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(new THREE.Color(0xfffdf9), 1);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const geometry = new THREE.PlaneGeometry(2, 2);

    const touch = new TouchTexture();

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTouch: { value: touch.texture },
      // Raw sRGB 0-1 values — ShaderMaterial writes gl_FragColor straight to the
      // framebuffer, so no colour-space juggling. Milk #FFFDF9, and the app's
      // brand orange --color-orange #FC8019 with a lighter tint #FFA24D.
      uMilk: { value: new THREE.Vector3(1.0, 0.992, 0.976) },
      uOrange: { value: new THREE.Vector3(0.988, 0.502, 0.098) },
      uOrangeSoft: { value: new THREE.Vector3(1.0, 0.635, 0.302) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const measure = () => {
      const rect = container.getBoundingClientRect();
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
      if (w === 0 || h === 0) return;
      if (w === width && h === height) return;
      width = w;
      height = h;
      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(w, h);
    };

    window.addEventListener("resize", resize);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const onMove = (e: MouseEvent) => {
      touch.addTouch({
        x: e.clientX / window.innerWidth,
        y: 1 - e.clientY / window.innerHeight,
      });
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      touch.addTouch({
        x: t.clientX / window.innerWidth,
        y: 1 - t.clientY / window.innerHeight,
      });
    };
    const onLeave = () => {
      touch.last = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("mouseout", onLeave);

    let animationFrame = 0;
    const start = performance.now();
    const tick = () => {
      if (width === 0) resize();
      uniforms.uTime.value = (performance.now() - start) * 0.001;
      touch.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseout", onLeave);
      geometry.dispose();
      material.dispose();
      touch.texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FFFDF9] px-4 py-10">
      <LiquidBackground />

      <div className="relative z-10 w-full max-w-md rounded-[28px] border border-white/70 bg-white/70 p-8 shadow-[0_30px_80px_-24px_rgba(203,110,40,0.28)] ring-1 ring-black/[0.04] backdrop-blur-2xl backdrop-saturate-150 sm:p-10">
        <div className="flex flex-col items-center text-center">
          <Logo size={112} className="drop-shadow-[0_10px_24px_rgba(252,128,25,0.22)]" />
          <p className="mt-5 text-[15px] font-bold tracking-wide text-orange">
            Post Offer Engagement
          </p>
          <h1 className="mt-1 font-heading text-5xl font-extrabold tracking-tight text-charcoal">
            HRMS
          </h1>
          <p className="mt-2 text-[15px] text-text-secondary">
            Sign in to access your account
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label className="text-sm font-bold text-charcoal">Email ID</label>
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-black/[0.03] px-3 py-2.5 transition-colors focus-within:border-orange focus-within:bg-white">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange/10 text-orange">
                <EnvelopeIcon className="h-[18px] w-[18px]" />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email ID"
                className="w-full bg-transparent text-sm text-charcoal outline-none placeholder:text-text-secondary"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-charcoal">Password</label>
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-black/[0.03] px-3 py-2.5 transition-colors focus-within:border-orange focus-within:bg-white">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange/10 text-orange">
                <LockClosedIcon className="h-[18px] w-[18px]" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-transparent text-sm text-charcoal outline-none placeholder:text-text-secondary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="cursor-pointer text-text-secondary"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            <div className="mt-3 text-right">
              <button
                type="button"
                className="cursor-pointer text-sm font-bold text-orange hover:underline"
              >
                Forgot Password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ffa24d] to-orange py-4 text-[15px] font-bold text-white shadow-[0_16px_32px_-10px_rgba(252,128,25,0.6)] transition-[filter] hover:brightness-[1.05]"
          >
            Sign In
            <ArrowRightIcon className="h-[18px] w-[18px]" />
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-text-secondary">
          &copy; 2026 HRMS. All rights reserved.
        </p>
      </div>
    </div>
  );
}
