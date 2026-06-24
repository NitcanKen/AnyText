create or replace function public.anytext_safe_file_name(p_file_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := coalesce(nullif(pg_catalog.btrim(p_file_name), ''), 'attachment');
begin
  v_name := pg_catalog.regexp_replace(v_name, '[^A-Za-z0-9._-]+', '-', 'g');
  v_name := pg_catalog.regexp_replace(v_name, '\.{2,}', '-', 'g');
  v_name := pg_catalog.regexp_replace(v_name, '-{2,}', '-', 'g');
  v_name := pg_catalog.regexp_replace(v_name, '^[.-]+|[.-]+$', '', 'g');
  v_name := pg_catalog.left(v_name, 96);

  if v_name = '' then
    return 'attachment';
  end if;

  return v_name;
end;
$$;
