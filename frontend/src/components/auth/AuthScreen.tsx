"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Logo } from "@/components/layout/Logo";

/**
 * TouchTexture, a small offscreen canvas that records the pointer's recent
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
 * Liquid-gradient auth background: soft Swiggy-orange pigment flowing through
 * milky white. WebGL (three.js). Decorative only, aria-hidden, pointer-events
 * off. Pointer movement distorts the pigment along the path of travel; the
 * drift underneath is continuous regardless of the pointer.
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

    vec4 tt = texture2D(uTouch, uv);
    float vx = tt.r * 2.0 - 1.0;
    float vy = tt.g * 2.0 - 1.0;
    float inten = tt.b;
    uv += vec2(vx, vy) * 0.20 * inten;
    float dCen = length((uv - 0.5) * vec2(aspect, 1.0));
    uv += sin(dCen * 16.0 - uTime * 2.4) * 0.012 * inten;

    float field = 0.0;
    float warm = 0.0;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      vec2 home = vec2(
        0.5 + cos(fi * 2.3944) * 0.42,
        0.5 + sin(fi * 2.3944) * 0.42
      );
      vec2 c = home + vec2(
        sin(uTime * 0.60 + fi * 1.7) * 0.16,
        cos(uTime * 0.48 + fi * 2.3) * 0.16
      );
      float d = length((uv - c) * vec2(aspect, 1.0));
      float infl = smoothstep(0.46, 0.0, d) * (0.55 + 0.45 * sin(uTime * 1.35 + fi));
      field += infl;
      warm += infl * (0.5 + 0.5 * sin(uTime * 0.85 + fi * 2.0));
    }
    field = clamp(field, 0.0, 1.0);
    warm = clamp(warm / max(field, 0.001), 0.0, 1.0);

    float pigment = 0.07 + field * 0.28 + inten * 0.08;
    vec3 orange = mix(uOrangeSoft, uOrange, warm);
    vec3 col = mix(uMilk, orange, pigment);

    float g1 = fract(sin(dot(uv * uResolution, vec2(12.9898, 78.233))) * 43758.5453);
    float g2 = fract(sin(dot(uv * uResolution + uTime, vec2(39.346, 11.135))) * 24634.633);
    col += (g1 - 0.5) * 0.030;
    col += (g2 - 0.5) * 0.018;

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

/**
 * Shared shell for the auth screens (sign in, sign up, reset password). Owns
 * the liquid background and the glass card so every screen matches the login
 * page exactly. Children are the screen-specific form body.
 */
export function AuthScreen({
  subtitle,
  children,
}: {
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FFFDF9] px-4 py-10">
      <LiquidBackground />

      <div className="relative z-10 w-full max-w-md rounded-[32px] border border-orange/30 bg-gradient-to-br from-white/72 via-white/58 to-white/46 p-8 shadow-[0_30px_80px_-28px_rgba(41,41,41,0.22),inset_0_1px_0_rgba(255,255,255,0.75),inset_0_-1px_0_rgba(255,255,255,0.30)] ring-1 ring-white/40 backdrop-blur-3xl backdrop-saturate-150 sm:p-10">
        <div className="flex flex-col items-center text-center">
          <Logo size={64} />
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange">
            Post Offer Engagement
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-charcoal">
            HRMS
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">{subtitle}</p>
        </div>

        {children}

        <p className="mt-6 text-center text-[11px] text-text-secondary">
          Secured by Supabase Auth. Your session is encrypted and never leaves
          your device unprotected.
        </p>
      </div>
    </div>
  );
}
