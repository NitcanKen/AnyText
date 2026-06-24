create or replace function public.anytext_cleanup_attachment_candidates(p_limit integer default 100)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', candidate.id,
        'message_id', candidate.message_id,
        'room_id', candidate.room_id,
        'storage_path', candidate.storage_path
      )
      order by candidate.created_at, candidate.id
    ),
    '[]'::jsonb
  )
  from (
    select
      a.id,
      a.message_id,
      a.room_id,
      a.storage_path,
      a.created_at
    from public.attachments a
    join public.messages m on m.id = a.message_id and m.room_id = a.room_id
    where a.storage_path <> ''
      and (
        a.cleanup_pending = true
        or a.deleted_at is not null
        or a.expires_at <= pg_catalog.now()
        or m.deleted_at is not null
        or m.expires_at <= pg_catalog.now()
      )
    order by a.created_at, a.id
    limit least(greatest(coalesce(p_limit, 100), 1), 1000)
  ) candidate;
$$;

create or replace function public.anytext_cleanup_finalize(p_attachment_ids uuid[] default '{}'::uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attachment_ids uuid[] := coalesce(p_attachment_ids, '{}'::uuid[]);
  v_deleted_attachments integer := 0;
  v_deleted_messages integer := 0;
begin
  with deleted_attachments as (
    delete from public.attachments a
    using public.messages m
    where a.id = any(v_attachment_ids)
      and m.id = a.message_id
      and m.room_id = a.room_id
      and (
        a.cleanup_pending = true
        or a.deleted_at is not null
        or a.expires_at <= pg_catalog.now()
        or m.deleted_at is not null
        or m.expires_at <= pg_catalog.now()
      )
    returning a.id
  )
  select pg_catalog.count(*)::integer
  into v_deleted_attachments
  from deleted_attachments;

  with deleted_messages as (
    delete from public.messages m
    where (m.deleted_at is not null or m.expires_at <= pg_catalog.now())
      and not exists (
        select 1
        from public.attachments a
        where a.message_id = m.id
      )
    returning m.id
  )
  select pg_catalog.count(*)::integer
  into v_deleted_messages
  from deleted_messages;

  return pg_catalog.jsonb_build_object(
    'deleted_attachments', v_deleted_attachments,
    'deleted_messages', v_deleted_messages
  );
end;
$$;

revoke all on function public.anytext_cleanup_attachment_candidates(integer) from public, anon, authenticated;
revoke all on function public.anytext_cleanup_finalize(uuid[]) from public, anon, authenticated;
grant execute on function public.anytext_cleanup_attachment_candidates(integer) to service_role;
grant execute on function public.anytext_cleanup_finalize(uuid[]) to service_role;
