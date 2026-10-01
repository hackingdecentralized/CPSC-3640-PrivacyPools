'use server';

import { cookies } from 'next/headers';
import { getConstants } from '~/config/constants';

const { COOKIES } = getConstants();
const { USER_LOGGED, USER_CONNECTED } = COOKIES;

export async function setUserConnectedCookie() {
  const cookieStore = await cookies();
  cookieStore.set(USER_CONNECTED.name, USER_CONNECTED.value);
}

export async function deleteUserConnectedCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(USER_CONNECTED.name);
}

export async function setUserLoggedCookie() {
  const cookieStore = await cookies();
  cookieStore.set(USER_LOGGED.name, USER_LOGGED.value);
}

export async function deleteUserLoggedCookie() {
  const cookieStore = await cookies();

  if (cookieStore.get(USER_LOGGED.name)) {
    cookieStore.delete(USER_LOGGED.name);
  }
}
