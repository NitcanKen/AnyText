import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-anytext-cleanup-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

type CleanupCandidate = {
  id: string;
  storage_path: string;
};

type CleanupFinalizeResult = {
  deleted_attachments: number;
  deleted_messages: number;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  const cleanupToken = Deno.env.get('ANYTEXT_CLEANUP_TOKEN');

  if (!cleanupToken) {
    return jsonResponse({ error: 'cleanup function is not configured' }, 500);
  }

  if (!hasValidCleanupToken(request, cleanupToken)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'function is not configured' }, 500);
  }

  const body = await readOptionalJson(request);
  const limit = clampLimit(body?.limit);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data: candidates, error: candidateError } = await supabase.rpc('anytext_cleanup_attachment_candidates', {
    p_limit: limit,
  });

  if (candidateError) {
    return jsonResponse({ error: candidateError.message }, 500);
  }

  const cleanupCandidates = Array.isArray(candidates) ? (candidates as CleanupCandidate[]) : [];
  const storagePaths = [...new Set(cleanupCandidates.map((candidate) => candidate.storage_path).filter(Boolean))];

  if (storagePaths.length > 0) {
    const { error: removeError } = await supabase.storage.from('anytext-attachments').remove(storagePaths);

    if (removeError) {
      return jsonResponse({ error: removeError.message, storageCandidates: storagePaths.length }, 500);
    }
  }

  const { data: finalized, error: finalizeError } = await supabase.rpc('anytext_cleanup_finalize', {
    p_attachment_ids: cleanupCandidates.map((candidate) => candidate.id),
  });

  if (finalizeError) {
    return jsonResponse({ error: finalizeError.message }, 500);
  }

  const result = finalized as CleanupFinalizeResult | null;

  return jsonResponse({
    attachmentCandidates: cleanupCandidates.length,
    deletedAttachments: result?.deleted_attachments ?? 0,
    deletedMessages: result?.deleted_messages ?? 0,
    storageObjectsDeleted: storagePaths.length,
  });
});

function hasValidCleanupToken(request: Request, cleanupToken: string): boolean {
  const authorization = request.headers.get('authorization') ?? '';
  const bearerToken = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
  const headerToken = request.headers.get('x-anytext-cleanup-token')?.trim() ?? '';

  return bearerToken === cleanupToken || headerToken === cleanupToken;
}

async function readOptionalJson(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();

  if (!text.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);

    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function clampLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 100;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 1000);
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
