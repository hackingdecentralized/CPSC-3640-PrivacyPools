import { generateMerkleProof } from '@0xbow/privacy-pools-core-sdk';
import { describe, expect, it } from 'vitest';
import { treeRoot, treeView } from '../../src/tree.ts';

const LEAVES = [11n, 22n, 33n, 44n, 55n, 66n, 77n];

describe('treeRoot', () => {
  it.each([1, 2, 3, 4, 7])('matches the SDK root for %i leaves', (n) => {
    const leaves = LEAVES.slice(0, n);
    expect(treeRoot(leaves)).toBe(generateMerkleProof(leaves, leaves[n - 1]).root);
  });

  it('treats a single leaf as its own root', () => {
    expect(treeRoot([5n])).toBe(5n);
  });

  it('refuses an empty tree', () => {
    expect(() => treeRoot([])).toThrow(/empty/);
  });
});

describe('treeView', () => {
  it('returns layers from leaves to root and the SDK membership path', () => {
    const view = treeView(LEAVES, 33n);
    const sdk = generateMerkleProof(LEAVES, 33n);
    expect(view.layers[0]).toEqual(LEAVES.map(String));
    expect(view.layers.at(-1)).toEqual([sdk.root.toString()]);
    expect(view.root).toBe(sdk.root.toString());
    expect(view.size).toBe(7);
    expect(view.depth).toBe(3);
    expect(view.leafIndex).toBe(2);
    expect(view.siblings).toEqual(sdk.siblings.slice(0, view.siblings.length).map(String));
    expect(sdk.siblings.slice(view.siblings.length).every((s) => s === 0n)).toBe(true);
  });

  it('has no path for a leaf that is not in the tree', () => {
    const view = treeView(LEAVES, 999n);
    expect(view.leafIndex).toBeNull();
    expect(view.siblings).toEqual([]);
  });

  it('describes an empty tree with root 0', () => {
    expect(treeView([])).toEqual({ root: '0', size: 0, depth: 0, layers: [], leafIndex: null, siblings: [] });
  });
});
