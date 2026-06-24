import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

type DownloadTarget = {
  bucket: string;
  storage_path: string;
  file_name: string;
  expires_in: number;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'function is not configured' }, 500);
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid json body' }, 400);
  }

  const roomId = readString(body.roomId);
  const messageId = readString(body.messageId);
  const attachmentId = readString(body.attachmentId);
  const download = body.download === true;

  if (!roomId || !messageId || !attachmentId) {
    return jsonResponse({ error: 'roomId, messageId, and attachmentId are required' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data: target, error: targetError } = await supabase.rpc('anytext_get_attachment_download_target', {
    p_attachment_id: attachmentId,
    p_message_id: messageId,
    p_room_id: roomId,
  });

  if (targetError || !target) {
    return jsonResponse({ error: targetError?.message ?? 'attachment not found' }, 404);
  }

  const downloadTarget = target as DownloadTarget;
  const expiresIn = Math.min(Math.max(downloadTarget.expires_in || 60, 15), 300);
  const { data: signed, error: signedError } = await supabase.storage
    .from(downloadTarget.bucket)
    .createSignedUrl(downloadTarget.storage_path, expiresIn, {
      download: download ? downloadTarget.file_name : false,
    });

  if (signedError || !signed?.signedUrl) {
    return jsonResponse({ error: signedError?.message ?? 'failed to sign attachment url' }, 500);
  }

  return jsonResponse({
    expiresIn,
    signedUrl: signed.signedUrl,
  });
});

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}
