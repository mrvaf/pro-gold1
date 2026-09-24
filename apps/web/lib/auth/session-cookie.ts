export const SESSION_COOKIE_NAME = 'vgold_session';
export const SESSION_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface CookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

export const createSessionCookieConfig = (sessionId: string): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  };
};

export const createClearSessionCookieConfig = (): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  };
};
