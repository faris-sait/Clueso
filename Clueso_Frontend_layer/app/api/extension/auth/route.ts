import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * GET /api/extension/auth
 * Called by browser extension to check if user is authenticated
 * Returns user info if authenticated, or 401 if not
 */
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { authenticated: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json(
        { authenticated: false, error: 'User not found' },
        { status: 401 }
      );
    }

    // Get Supabase user ID
    const supabase = createServerSupabaseClient();
    const { data: supabaseUser } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    return NextResponse.json({
      authenticated: true,
      user: {
        clerkId: userId,
        supabaseId: supabaseUser?.id || null,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
      }
    });
  } catch (error) {
    console.error('Extension auth error:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Auth check failed' },
      { status: 500 }
    );
  }
}
