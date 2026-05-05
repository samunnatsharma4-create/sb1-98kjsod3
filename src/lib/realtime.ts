import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/**
 * Subscribe to a Supabase Realtime channel and log/status subscription errors safely.
 */
export function subscribeSafe(
  channel: RealtimeChannel,
  callbacks?: { name?: string; onError?: (message: string) => void },
): RealtimeChannel {
  const tag = callbacks?.name ?? channel.topic;

  void channel.subscribe((status, err) => {
    if (status === 'SUBSCRIBED') return;
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      const msg = `${tag}: realtime ${status}${err?.message ? ` — ${err.message}` : ''}`;
      console.error(msg, err ?? '');
      callbacks?.onError?.(msg);
    }
    if (status === 'CLOSED') {
      console.warn(`${tag}: realtime channel closed`);
    }
  });

  return channel;
}

export function removeChannelSafe(client: SupabaseClient, channel: RealtimeChannel) {
  void client.removeChannel(channel);
}
