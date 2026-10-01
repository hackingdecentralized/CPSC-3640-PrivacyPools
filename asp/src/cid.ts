import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import { sha256 } from 'multiformats/hashes/sha2';
import type { Address } from './types.ts';

export type SnapshotDocument = {
  chainId: number;
  entrypoint: Address;
  root: string;
  labels: string[];
  createdAt: number;
};

/** Canonical JSON for an Association Set snapshot. The on-chain CID commits to exactly these bytes. */
export function encodeSnapshotDocument(doc: SnapshotDocument): string {
  return JSON.stringify({
    chainId: doc.chainId,
    entrypoint: doc.entrypoint,
    root: doc.root,
    labels: doc.labels,
    createdAt: doc.createdAt,
  });
}

/** CIDv1, raw codec, sha2-256, base32: 59 chars, within Entrypoint.updateRoot's 32-64 length check. */
export async function cidOf(text: string): Promise<string> {
  const digest = await sha256.digest(new TextEncoder().encode(text));
  return CID.create(1, raw.code, digest).toString();
}
