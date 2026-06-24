create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id text primary key,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_policy_minutes integer not null default 60,
  constraint rooms_id_sha256_check check (id ~ '^[a-f0-9]{64}$'),
  constraint rooms_expires_policy_minutes_check check (expires_policy_minutes between 1 and 1440)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(id) on delete cascade,
  kind text not null default 'bundle',
  markdown_text text,
  text_size integer not null default 0,
  sender_device_name text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  deleted_at timestamptz,
  constraint messages_kind_check check (kind = 'bundle'),
  constraint messages_text_size_check check (text_size between 0 and 512000)
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  room_id text not null references public.rooms(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  mime_type text not null,
  file_size bigint not null,
  storage_path text not null,
  preview_kind text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  deleted_at timestamptz,
  constraint attachments_preview_kind_check check (preview_kind in ('image', 'download')),
  constraint attachments_file_size_check check (file_size between 1 and 26214400),
  constraint attachments_storage_path_check check (storage_path like ('rooms/' || room_id || '/%'))
);

create index if not exists messages_room_active_created_idx
  on public.messages (room_id, created_at desc)
  where deleted_at is null;

create index if not exists messages_active_expiry_idx
  on public.messages (expires_at)
  where deleted_at is null;

create index if not exists attachments_message_id_idx
  on public.attachments (message_id);

create index if not exists attachments_room_active_created_idx
  on public.attachments (room_id, created_at desc)
  where deleted_at is null;

create index if not exists attachments_active_expiry_idx
  on public.attachments (expires_at)
  where deleted_at is null;

alter table public.rooms enable row level security;
alter table public.rooms force row level security;
alter table public.messages enable row level security;
alter table public.messages force row level security;
alter table public.attachments enable row level security;
alter table public.attachments force row level security;

revoke all on public.rooms from anon, authenticated;
revoke all on public.messages from anon, authenticated;
revoke all on public.attachments from anon, authenticated;

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
    'expires_at', p_message.expires_at,
    'deleted_at', p_message.deleted_at
  );
$$;

create or replace function public.anytext_create_room(p_room_id text, p_device_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  if p_room_id is null or p_room_id !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid room id' using errcode = '22023';
  end if;

  insert into public.rooms (id, last_seen_at)
  values (p_room_id, pg_catalog.now())
  on conflict (id) do update
    set last_seen_at = excluded.last_seen_at
  returning * into v_room;

  return pg_catalog.jsonb_build_object(
    'id', v_room.id,
    'expires_policy_minutes', v_room.expires_policy_minutes
  );
end;
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
    and m.deleted_at is null
    and m.expires_at > pg_catalog.now();
$$;

create or replace function public.anytext_create_message(
  p_room_id text,
  p_markdown_text text,
  p_sender_device_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message public.messages;
  v_text_size integer;
begin
  if p_room_id is null or p_room_id !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid room id' using errcode = '22023';
  end if;

  if p_markdown_text is null or pg_catalog.btrim(p_markdown_text) = '' then
    raise exception 'markdown text is required' using errcode = '22023';
  end if;

  v_text_size := pg_catalog.octet_length(p_markdown_text);

  if v_text_size > 512000 then
    raise exception 'markdown text is over 500KB' using errcode = '22023';
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
    expires_at
  )
  values (
    p_room_id,
    'bundle',
    p_markdown_text,
    v_text_size,
    nullif(pg_catalog.btrim(p_sender_device_name), ''),
    pg_catalog.now() + interval '1 hour'
  )
  returning * into v_message;

  return public.anytext_message_to_json(v_message);
end;
$$;

create or replace function public.anytext_delete_message(p_room_id text, p_message_id uuid)
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

  update public.messages
  set deleted_at = coalesce(deleted_at, pg_catalog.now())
  where id = p_message_id
    and room_id = p_room_id
    and deleted_at is null
  returning * into v_message;

  if v_message.id is null then
    raise exception 'message not found' using errcode = '02000';
  end if;

  return public.anytext_message_to_json(v_message);
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

drop trigger if exists anytext_messages_broadcast_changes on public.messages;

create trigger anytext_messages_broadcast_changes
after insert or update or delete on public.messages
for each row execute function public.anytext_broadcast_message_change();

grant usage on schema public to anon, authenticated;
grant execute on function public.anytext_create_room(text, text) to anon, authenticated;
grant execute on function public.anytext_list_messages(text) to anon, authenticated;
grant execute on function public.anytext_create_message(text, text, text) to anon, authenticated;
grant execute on function public.anytext_delete_message(text, uuid) to anon, authenticated;

alter table realtime.messages enable row level security;

drop policy if exists "AnyText room broadcasts can be received" on realtime.messages;

create policy "AnyText room broadcasts can be received"
on realtime.messages
for select
to anon, authenticated
using (topic like 'anytext:room:%');

grant select on realtime.messages to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anytext-attachments', 'anytext-attachments', false, 26214400, null)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
