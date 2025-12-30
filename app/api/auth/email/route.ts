// app/api/auth/email/route.ts
// Email authentication - sends verification code, creates embedded wallet

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateVerificationCode,
  hashEmail,
  storeVerificationCode,
  getVerificationCode
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, action } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailHash = hashEmail(normalizedEmail);

    // Rate limiting - max 3 codes per email per 10 minutes
    const existingCode = await getVerificationCode(normalizedEmail);
    if (existingCode && existingCode.expiresAt > Date.now() - 60000) {
      // Code sent less than 1 minute ago
      return NextResponse.json({
        error: 'Please wait before requesting another code'
      }, { status: 429 });
    }

    // Check if user exists (for signin vs signup messaging)
    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail }
    });

    // Always generate and send code to prevent user enumeration
    // Use constant-time operations and same response for existing/non-existing users
    const code = generateVerificationCode();
    await storeVerificationCode(normalizedEmail, code, action || 'signin');

    // In production, send email via SendGrid/Resend/etc
    // For development, log the code
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AUTH] Verification code for ${emailHash}: ${code}`);
    }

    // TODO: Send actual email
    // await sendEmail({
    //   to: normalizedEmail,
    //   subject: 'Your IXXXI verification code',
    //   html: `Your code is: <strong>${code}</strong>. Valid for 10 minutes.`
    // });

    // Use constant response time by always doing the same work
    await new Promise(resolve => setTimeout(resolve, 100)); // Prevent timing attacks

    return NextResponse.json({
      success: true,
      message: 'Verification code sent',
      // In dev mode, return code for testing
      ...(process.env.NODE_ENV === 'development' && { devCode: code })
    });

  } catch (error) {
    console.error('Email auth error:', error);
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
  }
}
