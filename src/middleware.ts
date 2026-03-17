import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  if (authHeader && authHeader.startsWith('Basic ')) {
    const base64 = authHeader.slice(6);
    const decoded = atob(base64);
    // Split only on FIRST ':' — password may contain ':'
    const colonIndex = decoded.indexOf(':');
    const user = decoded.substring(0, colonIndex).trim();
    const pwd = decoded.substring(colonIndex + 1).trim();

    const expectedUser = (process.env.BASIC_AUTH_USER || '').trim();
    const expectedPwd = (process.env.BASIC_AUTH_PASSWORD || '').trim();

    // Debug log (remove after verifying it works)
    console.log('[middleware] auth attempt:', {
      user,
      envUserSet: !!expectedUser,
      envPwdSet: !!expectedPwd,
      match: user === expectedUser && pwd === expectedPwd,
    });

    if (expectedUser && expectedPwd && user === expectedUser && pwd === expectedPwd) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="AeroReclaim Dashboard"' },
  });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
