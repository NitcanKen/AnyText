-- Extend the AnyText item lifetime from one hour to one day.
--
-- Items stay temporary; only the window changes. Existing rows keep the
-- one-hour deadline they were created under — the new window applies to
-- messages/attachments created from here on.

alter table public.rooms
  alter column expires_policy_minutes set default 1440;

alter table public.messages
  alter column expires_at set default (now() + interval '1 day');

alter table public.attachments
  alter column expires_at set default (now() + interval '1 day');

update public.rooms
set expires_policy_minutes = 1440
where expires_policy_minutes = 60;

create or replace function public.anytext_create_message(
  p_room_id text,
  p_markdown_text text,
  p_sender_device_name text default null,
  p_attachments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message public.messages;
  v_text_size integer;
  v_attachment_count integer;
  v_attachment_input jsonb;
  v_attachment_id uuid;
  v_client_id text;
  v_file_name text;
  v_file_type text;
  v_mime_type text;
  v_file_size bigint;
  v_preview_kind text;
  v_storage_path text;
  v_targets jsonb := '[]'::jsonb;
begin
  if p_room_id is null or p_room_id !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid room id' using errcode = '22023';
  end if;

  if p_attachments is null or pg_catalog.jsonb_typeof(p_attachments) <> 'array' then
    raise exception 'attachments must be an array' using errcode = '22023';
  end if;

  v_attachment_count := pg_catalog.jsonb_array_length(p_attachments);
  v_text_size := pg_catalog.octet_length(coalesce(p_markdown_text, ''));

  if v_text_size > 512000 then
    raise exception 'markdown text is over 500KB' using errcode = '22023';
  end if;

  if v_attachment_count > 10 then
    raise exception 'maximum 10 attachments' using errcode = '22023';
  end if;

  if pg_catalog.btrim(coalesce(p_markdown_text, '')) = '' and v_attachment_count = 0 then
    raise exception 'markdown or attachment is required' using errcode = '22023';
  end if;

  insert into public.rooms (id, last_seen_at)
  values (p_room_id, pg_catalog.now())
  on conflict (id) do update
    set last_seen_at = excluded.last_seen_at;

  insert into public.messages (
    room_id,
    kind,
    markdown_text,
    text_size,
    sender_device_name,
    expires_at,
    updated_at,
    publish_status
  )
  values (
    p_room_id,
    'bundle',
    nullif(p_markdown_text, ''),
    v_text_size,
    nullif(pg_catalog.btrim(p_sender_device_name), ''),
    pg_catalog.now() + interval '1 day',
    pg_catalog.now(),
    case when v_attachment_count > 0 then 'draft' else 'published' end
  )
  returning * into v_message;

  for v_attachment_input in
    select value from pg_catalog.jsonb_array_elements(p_attachments)
  loop
    if pg_catalog.jsonb_typeof(v_attachment_input) <> 'object' then
      raise exception 'attachment metadata must be an object' using errcode = '22023';
    end if;

    v_client_id := nullif(pg_catalog.btrim(v_attachment_input ->> 'client_id'), '');
    v_file_name := nullif(pg_catalog.btrim(v_attachment_input ->> 'file_name'), '');
    v_file_type := coalesce(nullif(pg_catalog.btrim(v_attachment_input ->> 'file_type'), ''), 'file');
    v_mime_type := coalesce(nullif(pg_catalog.btrim(v_attachment_input ->> 'mime_type'), ''), 'application/octet-stream');
    v_file_size := (v_attachment_input ->> 'file_size')::bigint;

    if v_client_id is null then
      raise exception 'attachment client id is required' using errcode = '22023';
    end if;

    if v_file_name is null then
      raise exception 'attachment file name is required' using errcode = '22023';
    end if;

    if v_file_size < 0 or v_file_size > 26214400 then
      raise exception 'attachment is over 25MB' using errcode = '22023';
    end if;

    v_preview_kind := case
      when v_mime_type in ('image/gif', 'image/jpeg', 'image/png', 'image/webp') then 'image'
      else 'download'
    end;

    v_attachment_id := gen_random_uuid();
    v_storage_path :=
      'rooms/' || p_room_id ||
      '/messages/' || v_message.id::text ||
      '/' || v_attachment_id::text || '-' || public.anytext_safe_file_name(v_file_name);

    insert into public.attachments (
      id,
      message_id,
      room_id,
      file_name,
      file_type,
      mime_type,
      file_size,
      storage_path,
      preview_kind,
      expires_at,
      upload_status
    )
    values (
      v_attachment_id,
      v_message.id,
      p_room_id,
      v_file_name,
      pg_catalog.left(v_file_type, 80),
      pg_catalog.left(v_mime_type, 160),
      v_file_size,
      v_storage_path,
      v_preview_kind,
      v_message.expires_at,
      'pending'
    );

    v_targets := v_targets || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'id', v_attachment_id,
        'client_id', v_client_id,
        'message_id', v_message.id,
        'room_id', p_room_id,
        'file_name', v_file_name,
        'file_type', pg_catalog.left(v_file_type, 80),
        'mime_type', pg_catalog.left(v_mime_type, 160),
        'file_size', v_file_size,
        'storage_path', v_storage_path,
        'preview_kind', v_preview_kind,
        'created_at', pg_catalog.now(),
        'expires_at', v_message.expires_at,
        'deleted_at', null,
        'upload_status', 'pending'
      )
    );
  end loop;

  return pg_catalog.jsonb_set(public.anytext_message_to_json(v_message), '{attachments}', v_targets, true);
end;
$$;

grant execute on function public.anytext_create_message(text, text, text, jsonb) to anon, authenticated;
