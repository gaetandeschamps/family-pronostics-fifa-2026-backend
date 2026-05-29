const webpush = require('web-push');
const { supabase } = require('../db/supabase');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@pronostics.family'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function sendPushNotification(user, payload) {
  if (!user.push_subscription || !process.env.VAPID_PUBLIC_KEY) return;
  try {
    await webpush.sendNotification(user.push_subscription, JSON.stringify(payload));
  } catch (err) {
    if (err.statusCode === 410) {
      await supabase.schema('fifa2026').from('users').update({ push_subscription: null }).eq('id', user.id);
    }
  }
}

async function broadcastPush(userIds, payload) {
  const { data: users } = await supabase.schema('fifa2026').from('users')
    .select('id, push_subscription').in('id', userIds).not('push_subscription', 'is', null);
  for (const user of users ?? []) await sendPushNotification(user, payload);
}

module.exports = { sendPushNotification, broadcastPush };
