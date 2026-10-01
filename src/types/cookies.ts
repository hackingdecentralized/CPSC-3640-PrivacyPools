export type UserLoggedCookie = {
  name: 'userLogged';
  value: string;
};

export type UserConnectedCookie = {
  name: 'userConnected';
  value: string;
};

export type Cookies = {
  USER_LOGGED: UserLoggedCookie;
  USER_CONNECTED: UserConnectedCookie;
};
