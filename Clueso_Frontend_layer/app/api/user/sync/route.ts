import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * POST /api/user/sync
 * Syncs the current Clerk user to Supabase
 * Called when user first loads the dashboard
 */
export async function POST() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    let supabase;
    try {
      supabase = createServerSupabaseClient();
    } catch (configError) {
      console.error('Supabase config error:', configError);
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const email = user.emailAddresses[0]?.emailAddress;
    console.log('Syncing user:', { clerkId: userId, email });

    // Check if user already exists
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine for new users
      console.error('Error checking existing user:', selectError);
    }

    if (existingUser) {
      // Update existing user
      const { data, error } = await supabase
        .from('users')
        .update({
          email: email,
          first_name: user.firstName || null,
          last_name: user.lastName || null,
          avatar_url: user.imageUrl || null,
        })
        .eq('clerk_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Failed to update user', details: error.message }, { status: 500 });
      }

      console.log('User updated:', data?.id);
      return NextResponse.json({ user: data, action: 'updated' });
    }

    // Create new user
    const { data, error } = await supabase
      .from('users')
      .insert({
        clerk_id: userId,
        email: email,
        first_name: user.firstName || null,
        last_name: user.lastName || null,
        avatar_url: user.imageUrl || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return NextResponse.json({ error: 'Failed to create user', details: error.message }, { status: 500 });
    }

    console.log('User created:', data?.id);
    return NextResponse.json({ user: data, action: 'created' });
  } catch (error) {
    console.error('User sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
