import { encodeFunctionData, parseAbi } from 'viem';
import { privacyPoolAbi } from '~/utils/abi';
import { MigrationProofBundle } from '../types/migration';
import { MigrationMulticallCall, MigrationRelayerRequest } from '../types/relayer';
import { MULTICALL3_WITH_FALLBACK } from '../utils/constants';

const toProofArgs = (bundle: MigrationProofBundle) => {
  const proof = bundle.proof.proof;
  const publicSignals = bundle.proof.publicSignals;

  const pA = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])] as [bigint, bigint];

  const piB0 = proof.pi_b[0];
  const piB1 = proof.pi_b[1];

  // Groth16/BN254 proofs provide pi_b in [c0, c1] order, but the Solidity verifier expects [c1, c0].
  // Keep this swap aligned with the same conversion in src/hooks/useExit.ts.
  const pB = [
    [BigInt(piB0[1]), BigInt(piB0[0])],
    [BigInt(piB1[1]), BigInt(piB1[0])],
  ] as [[bigint, bigint], [bigint, bigint]];

  const pC = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])] as [bigint, bigint];

  const pubSignals = publicSignals.map((signal) => BigInt(signal)) as [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
  ];

  return { pA, pB, pC, pubSignals };
};

const MULTICALL3_ABI = parseAbi([
  'function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[] returnData)',
]);

export const buildMulticallPayloads = (bundles: readonly MigrationProofBundle[]): MigrationRelayerRequest => {
  const bundlesByChain = new Map<number, MigrationProofBundle[]>();

  for (const bundle of bundles) {
    const chainBundles = bundlesByChain.get(bundle.chainId) ?? [];
    chainBundles.push(bundle);
    bundlesByChain.set(bundle.chainId, chainBundles);
  }

  const sortedChainIds = [...bundlesByChain.keys()].sort((a, b) => a - b);
  const payloads: MigrationRelayerRequest = [];

  for (const [index, chainId] of sortedChainIds.entries()) {
    const chainBundles = bundlesByChain.get(chainId) ?? [];
    const sortedBundles = [...chainBundles].sort((a, b) => {
      if (a.poolAddress !== b.poolAddress) return a.poolAddress.localeCompare(b.poolAddress);
      return String(a.commitmentLabel).localeCompare(String(b.commitmentLabel));
    });

    const multicallCalls: MigrationMulticallCall[] = [];

    for (const bundle of sortedBundles) {
      const proofArgs = toProofArgs(bundle);
      const withdrawCall = encodeFunctionData({
        abi: privacyPoolAbi,
        functionName: 'withdraw',
        args: [bundle.withdrawal, proofArgs],
      });

      multicallCalls.push({
        target: bundle.poolAddress,
        allowFailure: false,
        callData: withdrawCall,
      });
    }

    const callData = encodeFunctionData({
      abi: MULTICALL3_ABI,
      functionName: 'aggregate3',
      args: [multicallCalls],
    });

    payloads.push({
      txId: index + 1,
      chainId,
      to: MULTICALL3_WITH_FALLBACK,
      callData,
    });
  }

  return payloads;
};
