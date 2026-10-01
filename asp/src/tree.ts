import { LeanIMT } from '@zk-kit/lean-imt';
import { poseidon2 } from 'poseidon-lite';

const hash = (a: bigint, b: bigint): bigint => poseidon2([a, b]);

/** A tree rendered for the teaching UI: every layer (leaves first, root last) plus one leaf's membership path. */
export type TreeView = {
  root: string;
  size: number;
  depth: number;
  layers: string[][];
  leafIndex: number | null;
  siblings: string[];
};

/** Root of the Poseidon LeanIMT over `leaves` (same construction as the SDK's generateMerkleProof). */
export function treeRoot(leaves: bigint[]): bigint {
  if (leaves.length === 0) throw new Error('cannot compute the root of an empty tree');
  return new LeanIMT(hash, leaves).root;
}

export function treeView(leaves: bigint[], leaf?: bigint): TreeView {
  if (leaves.length === 0) return { root: '0', size: 0, depth: 0, layers: [], leafIndex: null, siblings: [] };
  const tree = new LeanIMT(hash, leaves);
  const index = leaf === undefined ? -1 : tree.indexOf(leaf);
  return {
    root: tree.root.toString(),
    size: tree.size,
    depth: tree.depth,
    layers: (JSON.parse(tree.export()) as (string | number)[][]).map((layer) => layer.map(String)),
    leafIndex: index === -1 ? null : index,
    siblings: index === -1 ? [] : tree.generateProof(index).siblings.map(String),
  };
}
