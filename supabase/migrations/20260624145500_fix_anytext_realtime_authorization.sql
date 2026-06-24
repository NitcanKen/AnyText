drop policy if exists "AnyText room broadcasts can be received" on realtime.messages;

create policy "AnyText room broadcasts can be received"
on realtime.messages
for select
to anon, authenticated
using (
  (select realtime.topic()) like 'anytext:room:%'
  and realtime.messages.extension = 'broadcast'
);
