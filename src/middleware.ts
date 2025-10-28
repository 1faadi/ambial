import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { NextRequest } from 'next/server';

// Define which routes should be protected (require authentication)
const protectedRoutes = [
  '/home',
  '/dashboard',
  // Add any other routes that require authentication
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the path is a public asset (like images, css, etc.)
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') || // Files with extensions like .jpg, .png, etc.
    pathname.startsWith('/api/') // Allow API routes to pass through
  ) {
    return NextResponse.next();
  }

  // Get the token from the session
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = !!token;

  // If the user is authenticated and trying to access the root path (login page),
  // redirect them to /home
  if (isAuthenticated && pathname === '/') {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  // If the user is trying to access a protected route but not authenticated, redirect to / where there is login form
  if (
    !isAuthenticated &&
    protectedRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))
  ) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
