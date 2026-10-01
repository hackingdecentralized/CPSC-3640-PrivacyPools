import { getConstants } from '~/config/constants';

// Session marker cookies. Upstream sets these through Server Actions (next/headers), which a static export
// (GitHub Pages) cannot host, so they are written from the browser instead. Nothing on the server reads them
// any more: the account-page redirect they fed lives in src/app/account/layout.tsx.

const { COOKIES } = getConstants();
const { USER_LOGGED, USER_CONNECTED } = COOKIES;

const setCookie = (name: string, value: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${value}; path=/; SameSite=Lax`;
};

const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
};

export async function setUserConnectedCookie() {
  setCookie(USER_CONNECTED.name, USER_CONNECTED.value);
}

export async function deleteUserConnectedCookie() {
  deleteCookie(USER_CONNECTED.name);
}

export async function setUserLoggedCookie() {
  setCookie(USER_LOGGED.name, USER_LOGGED.value);
}

export async function deleteUserLoggedCookie() {
  deleteCookie(USER_LOGGED.name);
}
