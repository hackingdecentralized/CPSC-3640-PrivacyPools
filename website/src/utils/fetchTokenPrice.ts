import { PublicClient } from 'viem';
import { PoolInfo } from '~/config';

/*
 * CPSC 3640: prices are stubbed out.
 *
 * Upstream queried Alchemy's price API (and a Uniswap pool for FXN). The course
 * runs on Sepolia with test tokens that have no market price, and the site
 * makes no third-party calls, so every price is "unknown". Callers already
 * treat a null/0 price as unknown and hide the USD figures.
 */

/** Always 0 (unknown): the FXN incentive figures are mainnet-only. */
export const fetchFxnPrice: (publicClient: PublicClient) => Promise<number> = async () => 0;

/** Always null (unknown): no price feed for the course's test assets. */
export const fetchTokenPrice: (
  tokenSymbol: string,
  poolInfo?: PoolInfo,
  publicClient?: PublicClient,
) => Promise<number | null> = async () => null;
