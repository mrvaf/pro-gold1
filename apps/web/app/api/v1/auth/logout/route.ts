import { NextResponse, type NextRequest } from 'next/server';
import { getDefaultAuthService } from '@/lib/auth/auth.service';
import {
  SESSION_COOKIE_NAME,
  createClearSessionCookieConfig,
} from '@/lib/auth/session-cookie';

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionId) {
    const authService = getDefaultAuthService();
    await authService.logout(sessionId);
  }

  const clearCookie = createClearSessionCookieConfig();
  const response = NextResponse.json({ message: 'Logged out successfully.' });

  response.cookies.set(clearCookie.name, clearCookie.value, {
    httpOnly: clearCookie.httpOnly,
    secure: clearCookie.secure,
    sameSite: clearCookie.sameSite,
    path: clearCookie.path,
    maxAge: clearCookie.maxAge,
  });

  return response;
}
