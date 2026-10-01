import { Log } from 'viem';
export interface MerkleProof {
  root: bigint;
  siblings: bigint[];
  indices: number[];
}

export interface RagequitProof {
  proof: {
    pi_a: [bigint, bigint, bigint];
    pi_b: [[bigint, bigint], [bigint, bigint], [bigint, bigint]];
    pi_c: [bigint, bigint, bigint];
  };
  publicSignals: [bigint, bigint, bigint, bigint, bigint];
}

export type LeafInsertedLog = Log & {
  args: {
    _index: bigint;
    _leaf: bigint;
  };
};
