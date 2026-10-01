'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ROUTER } from '~/utils';
import { useMigration } from '../hooks/useMigration';

export const MigrationGate = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { isActive, isBlocking } = useMigration();

  useEffect(() => {
    if (!isActive || !isBlocking) return;
    if (pathname === ROUTER.home.base) return;

    router.replace(ROUTER.home.base);
  }, [isActive, isBlocking, pathname, router]);

  return null;
};
