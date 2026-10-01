import { createHash } from 'node:crypto';
import { CID } from 'multiformats/cid';
import { describe, expect, it } from 'vitest';
import { cidOf, encodeSnapshotDocument } from '../../src/cid.ts';

const DOC = {
  chainId: 11155111,
  entrypoint: '0x1000000000000000000000000000000000000004' as const,
  root: '5',
  labels: ['1', '2'],
  createdAt: 7,
};

describe('encodeSnapshotDocument', () => {
  it('produces canonical JSON with a fixed key order', () => {
    const shuffled = { labels: ['1', '2'], createdAt: 7, root: '5', chainId: 11155111, entrypoint: DOC.entrypoint };
    expect(encodeSnapshotDocument(shuffled)).toBe(
      '{"chainId":11155111,"entrypoint":"0x1000000000000000000000000000000000000004","root":"5","labels":["1","2"],"createdAt":7}',
    );
  });
});

describe('cidOf', () => {
  it('is a 59-character CIDv1 (raw, sha2-256), inside the Entrypoint 32-64 limit', async () => {
    const cid = await cidOf('hello');
    expect(cid).toMatch(/^bafkrei[a-z2-7]+$/);
    expect(cid).toHaveLength(59);
  });

  it('commits to the sha256 of exactly the given text', async () => {
    const text = encodeSnapshotDocument(DOC);
    const parsed = CID.parse(await cidOf(text));
    expect(parsed.version).toBe(1);
    expect(parsed.code).toBe(0x55);
    expect(parsed.multihash.code).toBe(0x12);
    expect(Buffer.from(parsed.multihash.digest).toString('hex')).toBe(createHash('sha256').update(text).digest('hex'));
  });

  it('is deterministic and content-sensitive', async () => {
    expect(await cidOf('a')).toBe(await cidOf('a'));
    expect(await cidOf('a')).not.toBe(await cidOf('b'));
  });
});
