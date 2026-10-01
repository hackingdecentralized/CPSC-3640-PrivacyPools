import { allPoolsChainData, chainData, defaultMetadata } from '~/config';
import { PoolPage } from './PoolPage';

export const metadata = defaultMetadata;

// A static export (GitHub Pages) needs every pool page at build time. These are the pools the app links to
// (`/pools/${chainId}/${asset.toLowerCase()}` in AllPoolsStats, UserPoolsStats and AdvancedNavigation): the
// course pools from course.json with NEXT_PUBLIC_IS_TESTNET=true. Any other path is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  const pools = [...Object.values(allPoolsChainData), ...Object.values(chainData)].flatMap((chain) => chain.poolInfo);
  const params = pools.map((pool) => ({ chain_id: String(pool.chainId), pool_id: pool.asset.toLowerCase() }));
  return params.filter(
    (param, index) =>
      params.findIndex((other) => other.chain_id === param.chain_id && other.pool_id === param.pool_id) === index,
  );
}

interface PageProps {
  params: Promise<{
    chain_id: string;
    pool_id: string;
  }>;
}

const Pool = async ({ params }: PageProps) => {
  const { chain_id, pool_id } = await params;
  return <PoolPage chainId={chain_id} poolId={pool_id} />;
};

export default Pool;
