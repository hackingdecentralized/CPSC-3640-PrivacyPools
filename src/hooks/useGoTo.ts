'use client';

import { useRouter } from 'next/navigation';
import { isValidRoute } from '~/utils';

export const useGoTo = () => {
  const nextRouter = useRouter();

  const goTo = (route: string) => {
    if (!isValidRoute(route)) {
      throw new Error(`Invalid route: ${route}`);
    }

    nextRouter.push(route);
  };

  return goTo;
};
