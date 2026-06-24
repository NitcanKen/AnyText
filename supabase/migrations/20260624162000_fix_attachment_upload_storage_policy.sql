create or replace function public.anytext_can_upload_storage_path(p_storage_path text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.attachments a
    where a.storage_path = p_storage_path
      and a.deleted_at is null
      and a.expires_at > pg_catalog.now()
      and a.upload_status = 'pending'
  );
$$;

drop policy if exists "AnyText registered attachment uploads" on storage.objects;

create policy "AnyText registered attachment uploads"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'anytext-attachments'
  and public.anytext_can_upload_storage_path(storage.objects.name)
);

grant execute on function public.anytext_can_upload_storage_path(text) to anon, authenticated;
