import { defaultMetadata } from '~/config';
import { PoolPage } from './PoolPage';

export const metadata = defaultMetadata;

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
