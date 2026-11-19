import { describe, expect, test } from 'vitest';
import type { Frame, Piece } from './page';
import { pieceCaller } from './pieces';

const frame = { now: 0, dt: 1 / 60, alpha: 1 } as Frame;

describe('every piece called, whatever one of them does (stage 5.5a)', () => {
  test('one that throws on every frame is told once; the pieces after it, and the drawing, go on', () => {
    const order: string[] = [];
    const told: string[] = [];
    const pieces: Piece[] = [
      { frame: () => void order.push('a') },
      {
        frame: () => {
          throw new Error('an effect broke');
        },
      },
      { frame: () => void order.push('c') },
    ];
    const pieceCalls = pieceCaller(pieces, (text) => told.push(text));
    for (let i = 0; i < 3; i++) {
      pieceCalls.call('frame', frame);
      order.push('drawn');
    }
    expect(order).toEqual(['a', 'c', 'drawn', 'a', 'c', 'drawn', 'a', 'c', 'drawn']);
    expect(told).toHaveLength(1);
    expect(told[0]).toMatch(/number 1.*`frame`.*an effect broke/);
  });

  test('in the opposite order for `afterStep`; the same piece failing at another moment is told again', () => {
    const order: number[] = [];
    const told: string[] = [];
    const pieces: Piece[] = [0, 1, 2].map((i) => ({
      afterStep: () => void order.push(i),
      beforeStep: () => {
        if (i === 2) throw new Error('no');
      },
    }));
    const pieceCalls = pieceCaller(pieces, (text) => told.push(text));
    pieceCalls.callReversed('afterStep');
    pieceCalls.call('beforeStep');
    expect(order).toEqual([2, 1, 0]);
    expect(told).toHaveLength(1);
    // Before, the piece's `this` was the piece: still.
    const self: Piece & { seen?: Piece } = {
      frame() {
        self.seen = this;
      },
    };
    pieceCaller([self], () => {}).call('frame', frame);
    expect(self.seen).toBe(self);
  });
});
