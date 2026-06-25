alter table public.messages
  add column if not exists publish_status text not null default 'published';

alter table public.messages
  drop constraint if exists messages_publish_status_check,
  add constraint messages_publish_status_check check (publish_status in ('draft', 'published', 'failed'));

create index if not exists messages_room_published_created_idx
  on public.messages (room_id, publish_status, created_at desc)
  where deleted_at is null;

update public.messages
set publish_status = 'published'
where publish_status is null;

create or replace function public.anytext_message_to_json(p_message public.messages)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', p_message.id,
    'room_id', p_message.room_id,
    'kind', p_message.kind,
    'markdown_text', p_message.markdown_text,
    'text_size', p_message.text_size,
    'sender_device_name', p_message.sender_device_name,
    'created_at', p_message.created_at,
    'updated_at', p_message.updated_at,
    'expires_at', p_message.expires_at,
    'deleted_at', p_message.deleted_at,
    'publish_status', p_message.publish_status,
    'attachments', coalesce(
      (
        select pg_catalog.jsonb_agg(public.anytext_attachment_to_json(a) order by a.created_at, a.id)
        from public.attachments a
        where a.message_id = p_message.id
          and a.room_id = p_message.room_id
          and a.deleted_at is null
          and a.expires_at > pg_catalog.now()
          and a.upload_status = 'uploaded'
      ),
      '[]'::jsonb
    )
  );
$$;

create or replace function public.anytext_list_messages(p_room_id text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select case
    when p_room_id is null or p_room_id !~ '^[a-f0-9]{64}$' then
      pg_catalog.jsonb_build_array()
    else
      coalesce(
        pg_catalog.jsonb_agg(public.anytext_message_to_json(m) order by m.created_at desc),
        '[]'::jsonb
      )
  end
  from public.messages m
  where m.room_id = p_room_id
    and m.publish_status = 'published'
    and m.deleted_at is null
    and m.expires_at > pg_catalog.now();
$$;

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
    pg_catalog.now() + interval '1 hour',
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

create or replace function public.anytext_finalize_message_uploads(
  p_room_id text,
  p_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message public.messages;
begin
  if p_room_id is null or p_room_id !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid room id' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.attachments a
    where a.room_id = p_room_id
      and a.message_id = p_message_id
      and a.deleted_at is null
      and a.upload_status <> 'uploaded'
  ) then
    raise exception 'message still has pending attachments' using errcode = '22023';
  end if;

  update public.messages
  set publish_status = 'published',
      updated_at = pg_catalog.now()
  where id = p_message_id
    and room_id = p_room_id
    and deleted_at is null
    and expires_at > pg_catalog.now()
  returning * into v_message;

  if v_message.id is null then
    raise exception 'message not found' using errcode = '02000';
  end if;

  return public.anytext_message_to_json(v_message);
end;
$$;

create or replace function public.anytext_get_attachment_download_target(
  p_room_id text,
  p_message_id uuid,
  p_attachment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attachment public.attachments;
begin
  if p_room_id is null or p_room_id !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid room id' using errcode = '22023';
  end if;

  select a.*
  into v_attachment
  from public.attachments a
  join public.messages m on m.id = a.message_id and m.room_id = a.room_id
  where a.id = p_attachment_id
    and a.message_id = p_message_id
    and a.room_id = p_room_id
    and a.deleted_at is null
    and a.expires_at > pg_catalog.now()
    and a.upload_status = 'uploaded'
    and m.publish_status = 'published'
    and m.deleted_at is null
    and m.expires_at > pg_catalog.now();

  if v_attachment.id is null then
    raise exception 'attachment not found' using errcode = '02000';
  end if;

  return pg_catalog.jsonb_build_object(
    'bucket', 'anytext-attachments',
    'storage_path', v_attachment.storage_path,
    'file_name', v_attachment.file_name,
    'mime_type', v_attachment.mime_type,
    'preview_kind', v_attachment.preview_kind,
    'expires_in', 60
  );
end;
$$;

create or replace function public.anytext_broadcast_message_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id text := coalesce(new.room_id, old.room_id);
begin
  if tg_op = 'INSERT' and new.publish_status <> 'published' then
    return null;
  end if;

  if tg_op = 'UPDATE'
    and coalesce(new.publish_status, '') <> 'published'
    and coalesce(old.publish_status, '') <> 'published'
  then
    return null;
  end if;

  if tg_op = 'DELETE' and old.publish_status <> 'published' then
    return null;
  end if;

  perform realtime.broadcast_changes(
    'anytext:room:' || v_room_id,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );

  return null;
end;
$$;

grant execute on function public.anytext_list_messages(text) to anon, authenticated;
grant execute on function public.anytext_create_message(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.anytext_finalize_message_uploads(text, uuid) to anon, authenticated;
grant execute on function public.anytext_get_attachment_download_target(text, uuid, uuid) to anon, authenticated;
