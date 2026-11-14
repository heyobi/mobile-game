import {
  BlendMode,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  TileMode,
  type SkCanvas,
  type SkImage,
  type SkPaint,
  type SkPath,
  type SkPicture,
} from '@shopify/react-native-skia';
import { ENEMIES, ENEMY_BULLET, PLAYER } from '../game/config';
import type { World } from '../game/types';
import { stats } from '../game/world';

/**
 * Neon renderer. Draws a whole frame into an SkPicture (no React elements per entity),
 * with additive glow sprites, so hundreds of enemies and particles stay cheap.
 */

export interface Joystick {
  active: boolean;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

export interface View {
  width: number;
  height: number;
  /** 0..1, dims the scene (menu backdrop). */
  dim?: number;
}

const BG = '#06040f';
const GRID = 56;
const GLOW_SIZE = 64;

let glowImage: SkImage | null = null;
const glowPaints = new Map<string, SkPaint>();
const strokePaints = new Map<string, SkPaint>();
const fillPaints = new Map<string, SkPaint>();
const dotPaints = new Map<string, SkPaint>();
const polygons = new Map<number, SkPath>();

function glow(): SkImage | null {
  if (glowImage) return glowImage;
  const surface = Skia.Surface.Make(GLOW_SIZE, GLOW_SIZE);
  if (!surface) return null;
  const c = surface.getCanvas();
  const p = Skia.Paint();
  p.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: GLOW_SIZE / 2, y: GLOW_SIZE / 2 },
      GLOW_SIZE / 2,
      [Skia.Color('rgba(255,255,255,1)'), Skia.Color('rgba(255,255,255,0.35)'), Skia.Color('rgba(255,255,255,0)')],
      [0, 0.35, 1],
      TileMode.Clamp
    )
  );
  c.drawCircle(GLOW_SIZE / 2, GLOW_SIZE / 2, GLOW_SIZE / 2, p);
  surface.flush();
  glowImage = surface.makeImageSnapshot();
  return glowImage;
}

function glowPaint(color: string): SkPaint {
  let p = glowPaints.get(color);
  if (!p) {
    p = Skia.Paint();
    p.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color(color), BlendMode.SrcIn));
    p.setBlendMode(BlendMode.Plus);
    glowPaints.set(color, p);
  }
  return p;
}

function strokePaint(color: string): SkPaint {
  let p = strokePaints.get(color);
  if (!p) {
    p = Skia.Paint();
    p.setColor(Skia.Color(color));
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(2.5);
    p.setStrokeJoin(StrokeJoin.Round);
    p.setStrokeCap(StrokeCap.Round);
    p.setAntiAlias(true);
    strokePaints.set(color, p);
  }
  return p;
}

function fillPaint(color: string): SkPaint {
  let p = fillPaints.get(color);
  if (!p) {
    p = Skia.Paint();
    p.setColor(Skia.Color(color));
    p.setAlphaf(0.18);
    p.setAntiAlias(true);
    fillPaints.set(color, p);
  }
  return p;
}

function dotPaint(color: string): SkPaint {
  let p = dotPaints.get(color);
  if (!p) {
    p = Skia.Paint();
    p.setColor(Skia.Color(color));
    p.setBlendMode(BlendMode.Plus);
    p.setAntiAlias(true);
    dotPaints.set(color, p);
  }
  return p;
}

/** Unit polygon (radius 1) centred on the origin. */
function polygon(sides: number): SkPath {
  let path = polygons.get(sides);
  if (!path) {
    path = Skia.Path.Make();
    for (let i = 0; i < sides; i++) {
      const a = -Math.PI / 2 + (i / sides) * Math.PI * 2;
      if (i === 0) path.moveTo(Math.cos(a), Math.sin(a));
      else path.lineTo(Math.cos(a), Math.sin(a));
    }
    path.close();
    polygons.set(sides, path);
  }
  return path;
}

let shipPath: SkPath | null = null;
function ship(): SkPath {
  if (!shipPath) {
    shipPath = Skia.Path.Make();
    shipPath.moveTo(1.3, 0);
    shipPath.lineTo(-0.9, -0.85);
    shipPath.lineTo(-0.45, 0);
    shipPath.lineTo(-0.9, 0.85);
    shipPath.close();
  }
  return shipPath;
}

const GLOW_SRC = { x: 0, y: 0, width: GLOW_SIZE, height: GLOW_SIZE };

function drawGlow(c: SkCanvas, x: number, y: number, radius: number, color: string, alpha: number) {
  const img = glow();
  if (!img) return;
  const p = glowPaint(color);
  p.setAlphaf(Math.max(0, Math.min(1, alpha)));
  c.drawImageRect(img, GLOW_SRC, { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 }, p);
}

function drawShape(c: SkCanvas, path: SkPath, x: number, y: number, r: number, angleDeg: number, color: string, fill = true) {
  c.save();
  c.translate(x, y);
  c.rotate(angleDeg, 0, 0);
  c.scale(r, r);
  const stroke = strokePaint(color);
  stroke.setStrokeWidth(2.5 / r);
  if (fill) c.drawPath(path, fillPaint(color));
  c.drawPath(path, stroke);
  c.restore();
}

const lineP = Skia.Paint();
lineP.setColor(Skia.Color('#2a1d66'));
lineP.setStrokeWidth(1);
lineP.setAlphaf(0.55);

const bgP = Skia.Paint();
bgP.setColor(Skia.Color(BG));

const ringP = Skia.Paint();
ringP.setStyle(PaintStyle.Stroke);
ringP.setAntiAlias(true);
ringP.setBlendMode(BlendMode.Plus);

const overlayP = Skia.Paint();

const streakP = Skia.Paint();
streakP.setStyle(PaintStyle.Stroke);
streakP.setStrokeCap(StrokeCap.Round);
streakP.setBlendMode(BlendMode.Plus);
streakP.setAntiAlias(true);

/** Draws one frame of the world into a new picture. */
export function renderWorld(w: World, view: View, joystick?: Joystick): SkPicture {
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, view.width, view.height));
  const p = w.player;

  // Camera follows the player with a little screen shake.
  const shakeX = w.shake ? Math.sin(w.time * 91) * w.shake : 0;
  const shakeY = w.shake ? Math.cos(w.time * 73) * w.shake : 0;
  const camX = p.x - view.width / 2 + shakeX;
  const camY = p.y - view.height / 2 + shakeY;

  c.drawRect(Skia.XYWHRect(0, 0, view.width, view.height), bgP);

  // Background grid scrolls with the camera for a sense of speed.
  const gx = -(((camX % GRID) + GRID) % GRID);
  const gy = -(((camY % GRID) + GRID) % GRID);
  for (let x = gx; x < view.width; x += GRID) c.drawLine(x, 0, x, view.height, lineP);
  for (let y = gy; y < view.height; y += GRID) c.drawLine(0, y, view.width, y, lineP);

  c.save();
  c.translate(-camX, -camY);
  const inView = (x: number, y: number, m: number) =>
    x > camX - m && x < camX + view.width + m && y > camY - m && y < camY + view.height + m;

  // Gems
  for (const g of w.gems) {
    if (!inView(g.x, g.y, 20)) continue;
    const r = g.value > 1 ? 6 : 4;
    drawGlow(c, g.x, g.y, r * 3.2, '#3df5ff', 0.55);
    drawShape(c, polygon(4), g.x, g.y, r, w.time * 90, '#9dfbff', true);
  }

  // Nova rings
  for (const n of w.novas) {
    ringP.setColor(Skia.Color('#ff8a1f'));
    ringP.setAlphaf(Math.max(0, n.life / 0.45));
    ringP.setStrokeWidth(6);
    c.drawCircle(n.x, n.y, n.radius, ringP);
    ringP.setStrokeWidth(18);
    ringP.setAlphaf(Math.max(0, n.life / 0.45) * 0.25);
    c.drawCircle(n.x, n.y, n.radius, ringP);
  }

  // Enemies
  for (const e of w.enemies) {
    if (!inView(e.x, e.y, e.radius * 3)) continue;
    const def = ENEMIES[e.kind];
    const color = e.flash > 0 ? '#ffffff' : def.color;
    drawGlow(c, e.x, e.y, e.radius * (e.kind === 'boss' ? 3.4 : 2.6), def.color, e.kind === 'boss' ? 0.8 : 0.45);
    drawShape(c, polygon(def.sides), e.x, e.y, e.radius, (e.angle * 180) / Math.PI, color);
    if (e.kind === 'boss') {
      drawShape(c, polygon(def.sides), e.x, e.y, e.radius * 0.55, (-e.angle * 260) / Math.PI, color, false);
    }
  }

  // Enemy bullets
  for (const b of w.enemyBullets) {
    if (!inView(b.x, b.y, 20)) continue;
    drawGlow(c, b.x, b.y, ENEMY_BULLET.radius * 3.5, ENEMY_BULLET.color, 0.8);
    c.drawCircle(b.x, b.y, ENEMY_BULLET.radius * 0.7, dotPaint('#ffe2c4'));
  }

  // Player bullets: bright streaks along their velocity
  for (const b of w.bullets) {
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const tail = 0.045;
    const tx = b.x - b.vx * tail;
    const ty = b.y - b.vy * tail;
    drawGlow(c, b.x, b.y, b.radius * 4, '#3df5ff', 0.75);
    streakP.setStrokeWidth(b.radius * 2.2);
    streakP.setColor(Skia.Color('#3df5ff'));
    streakP.setAlphaf(0.55);
    c.drawLine(tx, ty, b.x, b.y, streakP);
    streakP.setStrokeWidth(b.radius * 0.9);
    streakP.setColor(Skia.Color('#f2feff'));
    streakP.setAlphaf(1);
    c.drawLine(b.x - (b.vx / sp) * b.radius * 3, b.y - (b.vy / sp) * b.radius * 3, b.x, b.y, streakP);
  }

  // Orbit blades
  const s = stats(w);
  for (let i = 0; i < s.orbitCount; i++) {
    const a = w.orbitAngle + (i / s.orbitCount) * Math.PI * 2;
    const bx = p.x + Math.cos(a) * s.orbitRadius;
    const by = p.y + Math.sin(a) * s.orbitRadius;
    drawGlow(c, bx, by, 26, '#3dff8b', 0.7);
    drawShape(c, polygon(3), bx, by, 9, (a * 180) / Math.PI + 90, '#b6ffd2');
  }

  // Player
  if (w.phase !== 'dead') {
    const blink = p.invuln > 0 && Math.floor(w.time * 20) % 2 === 0;
    drawGlow(c, p.x, p.y, PLAYER.radius * 4, '#3df5ff', 0.55);
    if (!blink) drawShape(c, ship(), p.x, p.y, PLAYER.radius, (p.aim * 180) / Math.PI, '#d6fdff');
  }

  // Particles
  for (const pt of w.particles) {
    if (!inView(pt.x, pt.y, 10)) continue;
    const a = pt.life / pt.maxLife;
    const paint = dotPaint(pt.color);
    paint.setAlphaf(a);
    c.drawCircle(pt.x, pt.y, pt.size * (0.4 + a * 0.6), paint);
  }
  c.restore();

  // Hurt vignette
  if (p.invuln > 0 && w.phase === 'playing') {
    overlayP.setColor(Skia.Color('#ff1f3d'));
    overlayP.setAlphaf((p.invuln / PLAYER.invulnSeconds) * 0.16);
    c.drawRect(Skia.XYWHRect(0, 0, view.width, view.height), overlayP);
  }

  if (view.dim) {
    overlayP.setColor(Skia.Color(BG));
    overlayP.setAlphaf(view.dim);
    c.drawRect(Skia.XYWHRect(0, 0, view.width, view.height), overlayP);
  }

  // Floating joystick (screen space)
  if (joystick?.active) {
    ringP.setColor(Skia.Color('#3df5ff'));
    ringP.setAlphaf(0.35);
    ringP.setStrokeWidth(2);
    c.drawCircle(joystick.ox, joystick.oy, 54, ringP);
    const knob = dotPaint('#3df5ff');
    knob.setAlphaf(0.35);
    c.drawCircle(joystick.x, joystick.y, 22, knob);
  }

  return rec.finishRecordingAsPicture();
}
