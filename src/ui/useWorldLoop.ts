import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SkPicture } from '@shopify/react-native-skia';
import { STEP } from '../game/config';
import type { InputState, World, WorldEvents } from '../game/types';
import { stepWorld } from '../game/world';
import { renderWorld, type Joystick, type View } from '../render/neon';

const MAX_STEPS_PER_FRAME = 4;

interface Options {
  world: React.RefObject<World | null>;
  view: View;
  input: () => InputState;
  joystick?: React.RefObject<Joystick>;
  running: boolean;
  /** Called after each frame that stepped the world. */
  onFrame?: (w: World, events: WorldEvents, now: number) => void;
}

/** Fixed-timestep simulation + one SkPicture per display frame. */
export function useWorldLoop({ world, view, input, joystick, running, onFrame }: Options): SkPicture | null {
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const opts = useRef({ view, input, onFrame, joystick });
  useLayoutEffect(() => {
    opts.current = { view, input, onFrame, joystick };
  });

  useEffect(() => {
    if (!running || view.width === 0) return undefined;
    let raf = 0;
    let last = 0;
    let acc = 0;
    const merged: WorldEvents = { kills: 0, hurt: 0, levelUp: false, bossSpawned: false, bossKilled: false, died: false, pickups: 0 };
    const frame = (now: number) => {
      const w = world.current;
      if (w) {
        const dt = last ? Math.min((now - last) / 1000, 0.1) : STEP;
        last = now;
        acc += dt;
        let steps = 0;
        merged.kills = 0;
        merged.hurt = 0;
        merged.pickups = 0;
        merged.levelUp = merged.bossSpawned = merged.bossKilled = merged.died = false;
        while (acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
          stepWorld(w, opts.current.input(), STEP);
          const e = w.events;
          merged.kills += e.kills;
          merged.hurt += e.hurt;
          merged.pickups += e.pickups;
          merged.levelUp ||= e.levelUp;
          merged.bossSpawned ||= e.bossSpawned;
          merged.bossKilled ||= e.bossKilled;
          merged.died ||= e.died;
          acc -= STEP;
          steps++;
        }
        if (steps === MAX_STEPS_PER_FRAME) acc = 0; // drop time instead of spiralling on slow frames
        setPicture(renderWorld(w, opts.current.view, opts.current.joystick?.current));
        opts.current.onFrame?.(w, merged, now);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, view.width, world]);

  return picture;
}
