// instrumentation.ts
// Next.js instrumentation file - runs before the application starts
// Perfect place to validate environment variables

export async function register() {
  // Validate environment variables on startup
  // This will throw an error and prevent the app from starting if validation fails
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./lib/env');

    try {
      const env = validateEnv();
      console.log('✅ Environment variables validated successfully');

      // Log configuration summary (without secrets)
      console.log('📋 Configuration:');
      console.log(`  - Environment: ${env.NODE_ENV}`);
      console.log(`  - Database: ${env.DATABASE_URL ? '✓ Configured' : '✗ Not configured'}`);
      console.log(`  - Redis: ${env.REDIS_URL || env.REDIS_HOST ? '✓ Configured' : '✗ Not configured'}`);
      console.log(`  - Solana RPC: ${env.NEXT_PUBLIC_SOLANA_RPC_URL}`);
      console.log(`  - Email service: ${env.RESEND_API_KEY ? '✓ Configured' : '✗ Not configured'}`);
      console.log(`  - Platform wallet: ${env.PLATFORM_WALLET ? '✓ Configured' : '✗ Not configured'}`);
    } catch (error) {
      console.error('❌ Failed to start application due to environment validation errors');
      throw error;
    }
  }
}
