import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  // Escape hatch SÓLO para desarrollo local: se activa desde .env.local, que
  // está en .gitignore y nunca llega a Vercel. Sin esto no se puede abrir el
  // dashboard en localhost sin teclear la contraseña en cada recarga.
  if (process.env.DISABLE_BASIC_AUTH === '1') return NextResponse.next();

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

    if (expectedUser && expectedPwd && user === expectedUser && pwd === expectedPwd) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="AeroReclaim Dashboard"' },
  });
}

// Las rutas /api también exigen contraseña: devuelven nombres, emails, notas de
// casos y delegaciones. Hasta el 03/10/2026 el matcher las excluía y cualquiera
// podía leerlas (y escribir en Notion) sin autenticarse. El navegador reenvía
// la cabecera Basic Auth en las llamadas del propio dashboard.
// Excepciones: /api/health (ping de mantenimiento, no devuelve datos) y
// /api/revalidate (protegido por su propio secreto).
export const config = {
  matcher: ['/((?!api/health|api/revalidate|_next/static|_next/image|favicon.ico).*)'],
};
