import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { sendCapiEvent } from '@/lib/fb-capi'
import { SIGNUP_BONUS_IMPULSES } from '@/lib/pricing'
import { notifyAdmin, fmt } from '@/lib/admin-notify'

export async function POST(req: Request) {
  try {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the endpoint
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400,
    })
  }

  const eventType = evt.type

  if (eventType === 'user.created') {
    const { id, email_addresses, image_url, first_name, last_name } = evt.data

    const email = email_addresses?.[0]?.email_address
    const name = [first_name, last_name].filter(Boolean).join(' ') || email?.split('@')[0] || ''

    if (email) {
      try {
        await db.insert(users).values({
          id,
          email,
          name,
          image: image_url || '',
          impulses: SIGNUP_BONUS_IMPULSES,
        })
        console.log(`User ${id} created in database via webhook`);
      } catch (err) {
        console.error('Error inserting user to database', err)
        return new Response('Error saving user', { status: 500 })
      }

      // Fire CompleteRegistration to Meta via CAPI. The event id matches
      // what <RegistrationTracker /> emits from the browser (`reg_<id>`)
      // so Meta dedupes the pair and counts one conversion, not two.
      // We await here so Vercel's serverless function doesn't terminate
      // before the request lands; the 3.5s timeout inside sendCapiEvent
      // guarantees this won't stall the webhook response past Clerk's
      // retry threshold.
      await sendCapiEvent({
        eventName: 'CompleteRegistration',
        eventId: `reg_${id}`,
        user: {
          email,
          externalId: id,
          clientIp: headerPayload.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined,
          clientUserAgent: headerPayload.get('user-agent') ?? undefined,
        },
        customData: {
          content_name: 'AICreative account',
          status: 'completed',
        },
      })

      // Push to Telegram on each new sign-up.
      notifyAdmin(
        `🎉 *Новая регистрация*\n\n` +
        `*Email:* ${fmt.esc(email)}\n` +
        (name ? `*Имя:* ${fmt.esc(name)}\n` : '') +
        `*ID:* \`${fmt.esc(id)}\`\n` +
        `*Бонус:* ${SIGNUP_BONUS_IMPULSES} ⚡`,
      );
    }
  }

  return new Response('', { status: 200 })
  } catch (err: any) {
    // Top-level safety net — page admin if our webhook handler itself
    // crashes, since silent failure here means lost signups.
    console.error('[clerk-webhook] crashed:', err);
    notifyAdmin(
      `🛑 *Clerk webhook упал*\n\n` +
      `*Ошибка:* ${fmt.esc(fmt.short(err?.message || String(err), 300))}\n\n` +
      `Регистрация юзера могла не сохраниться в БД. Проверь Vercel logs.`,
    );
    return new Response('Webhook handler crashed', { status: 500 });
  }
}
