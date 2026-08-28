drop policy if exists "interest_select" on public.class_interest;
drop policy if exists "interest_select_own" on public.class_interest;
create policy "interest_select_own" on public.class_interest
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "signups_select" on public.signups;
drop policy if exists "signups_select_involved" on public.signups;
create policy "signups_select_involved" on public.signups
  for select to authenticated
  using (
    auth.uid() = user_id
    or auth.uid() = (select teacher_id from public.classes where id = class_id)
  );

drop policy if exists "vouches_select" on public.vouches;
drop policy if exists "vouches_select_involved" on public.vouches;
create policy "vouches_select_involved" on public.vouches
  for select to authenticated
  using (auth.uid() = member_id or auth.uid() = candidate_id);

create or replace function public.class_signup_counts(class_ids uuid[])
returns table(class_id uuid, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select class_id, count(*)::bigint as n
  from public.signups
  where class_id = any(class_ids)
  group by class_id;
$$;

revoke execute on function public.class_signup_counts(uuid[]) from public, anon;
grant execute on function public.class_signup_counts(uuid[]) to authenticated, service_role;