import Image from 'next/image';
import { withBasePath } from '~/utils/basePath';

export const Logo = () => {
  return <Image src={withBasePath('/logo.svg')} alt='Privacy Pools logo' width={36} height={36} priority />;
};
