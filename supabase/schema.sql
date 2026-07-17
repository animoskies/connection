create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text not null,
  preferred_timezone text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists avatar_url text;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'group_role') then
    create type public.group_role as enum ('owner', 'editor', 'viewer');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'connection_status') then
    create type public.connection_status as enum ('pending', 'accepted');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'photo_share_scope') then
    create type public.photo_share_scope as enum ('private', 'connections', 'group');
  end if;
end $$;

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.group_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  token text not null unique,
  role public.group_role not null default 'viewer',
  created_by uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid references public.profiles(id) on delete cascade,
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.group_invites
  add column if not exists invitee_id uuid references public.profiles(id) on delete cascade,
  add column if not exists accepted_at timestamptz,
  add column if not exists declined_at timestamptz;

create index if not exists group_invites_token_idx on public.group_invites(token);
create index if not exists group_invites_group_id_idx on public.group_invites(group_id);
create index if not exists group_invites_invitee_id_idx on public.group_invites(invitee_id);

create table if not exists public.connections (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.connection_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  description text,
  location text,
  starts_at_utc timestamptz not null,
  source_timezone text not null,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  share_scope public.photo_share_scope not null default 'private',
  title text not null default 'Untitled',
  caption text,
  location text,
  storage_path text not null unique,
  taken_at timestamptz not null default now(),
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.photos
  add column if not exists share_scope public.photo_share_scope not null default 'private';

create index if not exists photos_owner_id_idx on public.photos(owner_id);
create index if not exists photos_group_id_idx on public.photos(group_id);
create index if not exists photos_taken_at_idx on public.photos(taken_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('connection-photos', 'connection-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('connection-avatars', 'connection-avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_group_member(target_group_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group_id and gm.user_id = target_user_id
  );
$$;

create or replace function public.group_role_for(target_group_id uuid, target_user_id uuid)
returns public.group_role
language sql
security definer
set search_path = public
stable
as $$
  select gm.role
  from public.group_members gm
  where gm.group_id = target_group_id and gm.user_id = target_user_id
  limit 1;
$$;

create or replace function public.are_connected(first_user_id uuid, second_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.connections c
    where c.status = 'accepted'
      and (
        (c.requester_id = first_user_id and c.addressee_id = second_user_id)
        or (c.requester_id = second_user_id and c.addressee_id = first_user_id)
      )
  );
$$;

create or replace function public.create_group_with_owner(group_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.groups (name, owner_id)
  values (group_name, auth.uid())
  returning * into new_group;

  insert into public.group_members (group_id, user_id, role)
  values (new_group.id, auth.uid(), 'owner');

  return new_group;
end;
$$;

create or replace function public.accept_group_invite(invite_token text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.group_invites;
  joined_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into invite
  from public.group_invites
  where token = invite_token
  limit 1;

  if invite.id is null then
    raise exception 'Invite link is invalid or expired';
  end if;

  if invite.accepted_at is not null then
    raise exception 'Invite has already been accepted';
  end if;

  if invite.declined_at is not null then
    raise exception 'Invite has already been declined';
  end if;

  if invite.invitee_id is not null and invite.invitee_id <> auth.uid() then
    raise exception 'This invite belongs to another account';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (invite.group_id, auth.uid(), invite.role)
  on conflict (group_id, user_id) do nothing;

  update public.group_invites
  set accepted_at = now()
  where id = invite.id;

  select * into joined_group
  from public.groups
  where id = invite.group_id;

  return joined_group;
end;
$$;

create or replace function public.decline_group_invite(invite_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.group_invites;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into invite
  from public.group_invites
  where token = invite_token
  limit 1;

  if invite.id is null then
    raise exception 'Invite link is invalid or expired';
  end if;

  if invite.invitee_id is not null and invite.invitee_id <> auth.uid() then
    raise exception 'This invite belongs to another account';
  end if;

  update public.group_invites
  set declined_at = now()
  where id = invite.id;
end;
$$;

create or replace function public.group_invite_details(invite_token text)
returns table (
  group_id uuid,
  group_name text,
  role public.group_role,
  inviter_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    g.id,
    g.name,
    gi.role,
    coalesce(p.display_name, p.username)
  from public.group_invites gi
  join public.groups g on g.id = gi.group_id
  join public.profiles p on p.id = gi.created_by
  where gi.token = invite_token
    and gi.accepted_at is null
    and gi.declined_at is null
    and (gi.invitee_id is null or gi.invitee_id = auth.uid())
  limit 1;
$$;

create or replace function public.pending_group_invites()
returns table (
  id uuid,
  token text,
  group_id uuid,
  group_name text,
  role public.group_role,
  inviter_name text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    gi.id,
    gi.token,
    g.id,
    g.name,
    gi.role,
    coalesce(p.display_name, p.username),
    gi.created_at
  from public.group_invites gi
  join public.groups g on g.id = gi.group_id
  join public.profiles p on p.id = gi.created_by
  where gi.invitee_id = auth.uid()
    and gi.accepted_at is null
    and gi.declined_at is null
  order by gi.created_at desc;
$$;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.connections enable row level security;
alter table public.events enable row level security;
alter table public.photos enable row level security;

drop policy if exists "Profiles are visible to signed in users" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Members can read groups" on public.groups;
drop policy if exists "Users can create groups" on public.groups;
drop policy if exists "Owners can update groups" on public.groups;
drop policy if exists "Members can read memberships" on public.group_members;
drop policy if exists "Owners can add members" on public.group_members;
drop policy if exists "Owners can manage members" on public.group_members;
drop policy if exists "Owners can remove members" on public.group_members;
drop policy if exists "Owners can read group invites" on public.group_invites;
drop policy if exists "Owners can create group invites" on public.group_invites;
drop policy if exists "Owners can delete group invites" on public.group_invites;
drop policy if exists "Users can read their connections" on public.connections;
drop policy if exists "Users can request connections" on public.connections;
drop policy if exists "Users can accept their connections" on public.connections;
drop policy if exists "Users can remove their connections" on public.connections;
drop policy if exists "Members can read events" on public.events;
drop policy if exists "Owners and editors can create events" on public.events;
drop policy if exists "Owners and editors can update events" on public.events;
drop policy if exists "Owners and editors can delete events" on public.events;
drop policy if exists "Members can read photos" on public.photos;
drop policy if exists "Members can create photos" on public.photos;
drop policy if exists "Owners can update their photos" on public.photos;
drop policy if exists "Owners can delete their photos" on public.photos;
drop policy if exists "Photo objects can be read by visible members" on storage.objects;
drop policy if exists "Users can upload their own photo objects" on storage.objects;
drop policy if exists "Users can update their own photo objects" on storage.objects;
drop policy if exists "Users can delete their own photo objects" on storage.objects;
drop policy if exists "Avatar objects are public" on storage.objects;
drop policy if exists "Users can upload their own avatar objects" on storage.objects;
drop policy if exists "Users can update their own avatar objects" on storage.objects;
drop policy if exists "Users can delete their own avatar objects" on storage.objects;

create policy "Profiles are visible to signed in users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Members can read groups"
  on public.groups for select
  to authenticated
  using (public.is_group_member(groups.id, auth.uid()));

create policy "Users can create groups"
  on public.groups for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Owners can update groups"
  on public.groups for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Members can read memberships"
  on public.group_members for select
  to authenticated
  using (user_id = auth.uid() or public.is_group_member(group_members.group_id, auth.uid()));

create policy "Owners can add members"
  on public.group_members for insert
  to authenticated
  with check (
    exists (
      select 1 from public.groups g
      where g.id = group_id and g.owner_id = auth.uid()
    )
  );

create policy "Owners can manage members"
  on public.group_members for update
  to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = group_id and g.owner_id = auth.uid()
    )
  );

create policy "Owners can remove members"
  on public.group_members for delete
  to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = group_id and g.owner_id = auth.uid()
    )
    or user_id = auth.uid()
  );

create policy "Owners can read group invites"
  on public.group_invites for select
  to authenticated
  using (
    invitee_id = auth.uid()
    or
    exists (
      select 1 from public.groups g
      where g.id = group_id and g.owner_id = auth.uid()
    )
  );

create policy "Owners can create group invites"
  on public.group_invites for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.groups g
      where g.id = group_id and g.owner_id = auth.uid()
    )
  );

create policy "Owners can delete group invites"
  on public.group_invites for delete
  to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = group_id and g.owner_id = auth.uid()
    )
  );

create policy "Users can read their connections"
  on public.connections for select
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "Users can request connections"
  on public.connections for insert
  to authenticated
  with check (requester_id = auth.uid());

create policy "Users can accept their connections"
  on public.connections for update
  to authenticated
  using (addressee_id = auth.uid() or requester_id = auth.uid())
  with check (addressee_id = auth.uid() or requester_id = auth.uid());

create policy "Users can remove their connections"
  on public.connections for delete
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "Members can read events"
  on public.events for select
  to authenticated
  using (public.is_group_member(events.group_id, auth.uid()));

create policy "Owners and editors can create events"
  on public.events for insert
  to authenticated
  with check (
    creator_id = auth.uid()
    and public.group_role_for(events.group_id, auth.uid()) in ('owner', 'editor')
  );

create policy "Owners and editors can update events"
  on public.events for update
  to authenticated
  using (public.group_role_for(events.group_id, auth.uid()) in ('owner', 'editor'));

create policy "Owners and editors can delete events"
  on public.events for delete
  to authenticated
  using (public.group_role_for(events.group_id, auth.uid()) in ('owner', 'editor'));

create policy "Members can read photos"
  on public.photos for select
  to authenticated
  using (
    owner_id = auth.uid()
    or (
      share_scope = 'connections'
      and public.are_connected(owner_id, auth.uid())
    )
    or (
      group_id is not null
      and public.is_group_member(group_id, auth.uid())
    )
  );

create policy "Members can create photos"
  on public.photos for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and (
      (share_scope in ('private', 'connections') and group_id is null)
      or (
        share_scope = 'group'
        and group_id is not null
        and public.group_role_for(group_id, auth.uid()) in ('owner', 'editor')
      )
    )
  );

create policy "Owners can update their photos"
  on public.photos for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete their photos"
  on public.photos for delete
  to authenticated
  using (owner_id = auth.uid());

create policy "Photo objects can be read by visible members"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'connection-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.photos p
        where p.storage_path = storage.objects.name
          and (
            p.owner_id = auth.uid()
            or (
              p.share_scope = 'connections'
              and public.are_connected(p.owner_id, auth.uid())
            )
            or (
              p.group_id is not null
              and public.is_group_member(p.group_id, auth.uid())
            )
          )
      )
    )
  );

create policy "Users can upload their own photo objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'connection-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own photo objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'connection-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own photo objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'connection-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Avatar objects are public"
  on storage.objects for select
  using (bucket_id = 'connection-avatars');

create policy "Users can upload their own avatar objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'connection-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatar objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'connection-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'connection-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
