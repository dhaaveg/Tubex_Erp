import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  verifyPassword,
  encryptSessionToken,
  sanitizeUser,
  SESSION_COOKIE_NAME,
  Role,
  parseRoles,
} from '@/lib/auth';
import { withApiHandler } from '@/lib/api-handler';

export const POST = withApiHandler(async (request: Request) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      // Constant-time / generic message to prevent email enumeration
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(user.password_hash, password);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { success: false, error: 'Account has been deactivated. Please contact your administrator.' },
        { status: 403 }
      );
    }

    // Generate unique session token (strict 2-hour idle window)
    const sessionId = `SES-${crypto.randomUUID()}`;
    const maxAgeSeconds = 7200; // 2 hours = 120 minutes = 7200 seconds
    const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);

    const clientIp = request.headers.get('x-forwarded-for') || 'local';
    const userAgent = request.headers.get('user-agent') || 'browser';

    // Store session in DB
    await prisma.session.create({
      data: {
        session_token: sessionId,
        user_id: user.id,
        user_agent: userAgent,
        ip_address: clientIp,
        expires_at: expiresAt,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'LOGIN',
        entity_type: 'Session',
        entity_id: sessionId,
        ip_address: clientIp,
        details: JSON.stringify({ email: user.email, role: user.role }),
      },
    });

    // Encrypt HTTP-only cookie token
    const userRoles = parseRoles(user);
    const token = await encryptSessionToken({
      sessionId,
      userId: user.id,
      email: user.email,
      name: user.name,
      role: userRoles[0] || (user.role as Role),
      roles: userRoles,
      force_password_change: user.force_password_change,
      exp: Date.now() + maxAgeSeconds * 1000,
    });

    const response = NextResponse.json({
      success: true,
      user: sanitizeUser(user),
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds,
      expires: expiresAt,
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error during login' },
      { status: 500 }
    );
  }
});
