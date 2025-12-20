import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET to .env.local');
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing svix headers', { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error: Verification failed', { status: 400 });
  }

  const eventType = evt.type;
  const supabase = createServerSupabaseClient();

  // Handle user.created - Create user in Supabase
  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    const email = email_addresses[0]?.email_address;

    console.log('Creating user in Supabase:', { clerk_id: id, email });

    const { error } = await supabase.from('users').insert({
      clerk_id: id,
      email: email,
      first_name: first_name || null,
      last_name: last_name || null,
      avatar_url: image_url || null,
    });

    if (error) {
      console.error('Error creating user in Supabase:', error);
      return new Response('Error creating user', { status: 500 });
    }

    console.log('User created successfully in Supabase');
  }

  // Handle user.updated - Update user in Supabase
  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    const email = email_addresses[0]?.email_address;

    console.log('Updating user in Supabase:', { clerk_id: id });

    const { error } = await supabase
      .from('users')
      .update({
        email: email,
        first_name: first_name || null,
        last_name: last_name || null,
        avatar_url: image_url || null,
      })
      .eq('clerk_id', id);

    if (error) {
      console.error('Error updating user in Supabase:', error);
      return new Response('Error updating user', { status: 500 });
    }

    console.log('User updated successfully in Supabase');
  }

  // Handle user.deleted - Delete user from Supabase
  if (eventType === 'user.deleted') {
    const { id } = evt.data;

    console.log('Deleting user from Supabase:', { clerk_id: id });

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('clerk_id', id);

    if (error) {
      console.error('Error deleting user from Supabase:', error);
      return new Response('Error deleting user', { status: 500 });
    }

    console.log('User deleted successfully from Supabase');
  }

  return new Response('Webhook processed', { status: 200 });
}
