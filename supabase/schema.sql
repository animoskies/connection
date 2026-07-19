create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null,
  preferred_timezone text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_username_check;

update public.profiles
set username = lower(username)
where username <> lower(username);

alter table public.profiles
  add constraint profiles_username_check check (username ~ '^[a-z0-9_]{3,24}$');

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

create table if not exists public.group_notifications (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.group_notifications
  add column if not exists actor_id uuid references public.profiles(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists read_at timestamptz;

create index if not exists group_notifications_user_id_idx on public.group_notifications(user_id, read_at, created_at desc);
create index if not exists group_notifications_group_id_idx on public.group_notifications(group_id);

create table if not exists public.connection_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.connection_notifications
  add column if not exists actor_id uuid references public.profiles(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists read_at timestamptz;

create index if not exists connection_notifications_user_id_idx on public.connection_notifications(user_id, read_at, created_at desc);

create table if not exists public.connections (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.connection_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create unique index if not exists connections_unique_pair_idx
  on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

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

create or replace function public.notify_group_members(target_group_id uuid, notification_message text, notification_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_group_member(target_group_id, auth.uid()) then
    raise exception 'Only group members can notify this group';
  end if;

  insert into public.group_notifications (group_id, user_id, actor_id, message, metadata)
  select target_group_id, gm.user_id, auth.uid(), notification_message, coalesce(notification_metadata, '{}'::jsonb)
  from public.group_members gm
  where gm.group_id = target_group_id
    and gm.user_id <> auth.uid();
end;
$$;

drop function if exists public.pending_group_notifications();

create or replace function public.pending_group_notifications()
returns table (
  id uuid,
  group_id uuid,
  group_name text,
  actor_name text,
  message text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    gn.id,
    gn.group_id,
    g.name,
    coalesce(p.display_name, p.username),
    gn.message,
    gn.metadata,
    gn.read_at,
    gn.created_at
  from public.group_notifications gn
  join public.groups g on g.id = gn.group_id
  left join public.profiles p on p.id = gn.actor_id
  where gn.user_id = auth.uid()
  order by gn.created_at desc;
$$;

create or replace function public.mark_group_notification_read(notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.group_notifications
  set read_at = now()
  where id = notification_id
    and user_id = auth.uid();
end;
$$;

drop function if exists public.pending_connection_notifications();

create or replace function public.pending_connection_notifications()
returns table (
  id uuid,
  actor_id uuid,
  actor_name text,
  actor_username text,
  actor_avatar_url text,
  message text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    cn.id,
    cn.actor_id,
    coalesce(p.display_name, p.username),
    p.username,
    p.avatar_url,
    cn.message,
    cn.metadata,
    cn.read_at,
    cn.created_at
  from public.connection_notifications cn
  left join public.profiles p on p.id = cn.actor_id
  where cn.user_id = auth.uid()
  order by cn.created_at desc;
$$;

create or replace function public.mark_connection_notification_read(notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.connection_notifications
  set read_at = now()
  where id = notification_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.connection_relationship(target_user_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when auth.uid() is null then 'none'
    when target_user_id = auth.uid() then 'self'
    when exists (
      select 1
      from public.connections c
      where c.status = 'accepted'
        and (
          (c.requester_id = auth.uid() and c.addressee_id = target_user_id)
          or (c.requester_id = target_user_id and c.addressee_id = auth.uid())
        )
    ) then 'connected'
    when exists (
      select 1
      from public.connections c
      where c.status = 'pending'
        and c.requester_id = auth.uid()
        and c.addressee_id = target_user_id
    ) then 'pending_sent'
    when exists (
      select 1
      from public.connections c
      where c.status = 'pending'
        and c.requester_id = target_user_id
        and c.addressee_id = auth.uid()
    ) then 'pending_received'
    else 'none'
  end;
$$;

create or replace function public.search_profiles(search_text text)
returns table (
  id uuid,
  username text,
  display_name text,
  preferred_timezone text,
  avatar_url text,
  relationship text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.preferred_timezone,
    p.avatar_url,
    public.connection_relationship(p.id)
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and length(trim(search_text)) >= 2
    and (
      p.username ilike '%' || trim(search_text) || '%'
      or p.display_name ilike '%' || trim(search_text) || '%'
    )
  order by
    case when p.username ilike trim(search_text) || '%' then 0 else 1 end,
    p.username
  limit 12;
$$;

create or replace function public.my_connections()
returns table (
  id uuid,
  username text,
  display_name text,
  preferred_timezone text,
  avatar_url text,
  relationship text,
  connected_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.preferred_timezone,
    p.avatar_url,
    'connected'::text,
    c.created_at
  from public.connections c
  join public.profiles p
    on p.id = case
      when c.requester_id = auth.uid() then c.addressee_id
      else c.requester_id
    end
  where auth.uid() is not null
    and c.status = 'accepted'
    and (c.requester_id = auth.uid() or c.addressee_id = auth.uid())
  order by p.display_name, p.username;
$$;

create or replace function public.pending_connection_requests()
returns table (
  requester_id uuid,
  username text,
  display_name text,
  preferred_timezone text,
  avatar_url text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.preferred_timezone,
    p.avatar_url,
    c.created_at
  from public.connections c
  join public.profiles p on p.id = c.requester_id
  where c.addressee_id = auth.uid()
    and c.status = 'pending'
  order by c.created_at desc;
$$;

create or replace function public.send_connection_request(target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.connections;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot connect with yourself';
  end if;

  select * into existing
  from public.connections c
  where (c.requester_id = auth.uid() and c.addressee_id = target_user_id)
     or (c.requester_id = target_user_id and c.addressee_id = auth.uid())
  limit 1;

  if existing.status = 'accepted' then
    return 'connected';
  end if;

  if existing.status = 'pending' and existing.requester_id = auth.uid() then
    return 'pending_sent';
  end if;

  if existing.status = 'pending' and existing.addressee_id = auth.uid() then
    update public.connections
    set status = 'accepted'
    where requester_id = target_user_id and addressee_id = auth.uid();
    return 'connected';
  end if;

  insert into public.connections (requester_id, addressee_id, status)
  values (auth.uid(), target_user_id, 'pending');

  return 'pending_sent';
end;
$$;

create or replace function public.accept_connection_request(requester_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.connections
  set status = 'accepted'
  where requester_id = requester_user_id
    and addressee_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Connection request not found';
  end if;

  insert into public.connection_notifications (user_id, actor_id, message, metadata)
  select
    requester_user_id,
    auth.uid(),
    coalesce(p.display_name, p.username) || ' accepted your connection request.',
    jsonb_build_object('type', 'connection_accepted', 'profileId', auth.uid())
  from public.profiles p
  where p.id = auth.uid();

  return 'connected';
end;
$$;

create or replace function public.decline_connection_request(requester_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.connections
  where requester_id = requester_user_id
    and addressee_id = auth.uid()
    and status = 'pending';
end;
$$;

create or replace function public.remove_connection(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.connections
  where status = 'accepted'
    and (
      (requester_id = auth.uid() and addressee_id = target_user_id)
      or (requester_id = target_user_id and addressee_id = auth.uid())
    );
end;
$$;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_notifications enable row level security;
alter table public.connection_notifications enable row level security;
alter table public.connections enable row level security;
alter table public.events enable row level security;
alter table public.photos enable row level security;

drop policy if exists "Profiles are visible to signed in users" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Members can read groups" on public.groups;
drop policy if exists "Users can create groups" on public.groups;
drop policy if exists "Owners can update groups" on public.groups;
drop policy if exists "Owners can delete groups" on public.groups;
drop policy if exists "Members can read memberships" on public.group_members;
drop policy if exists "Owners can add members" on public.group_members;
drop policy if exists "Owners can manage members" on public.group_members;
drop policy if exists "Owners can remove members" on public.group_members;
drop policy if exists "Owners can read group invites" on public.group_invites;
drop policy if exists "Owners can create group invites" on public.group_invites;
drop policy if exists "Owners can delete group invites" on public.group_invites;
drop policy if exists "Users can read group notifications" on public.group_notifications;
drop policy if exists "Users can update group notifications" on public.group_notifications;
drop policy if exists "Users can read connection notifications" on public.connection_notifications;
drop policy if exists "Users can update connection notifications" on public.connection_notifications;
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

create policy "Owners can delete groups"
  on public.groups for delete
  to authenticated
  using (owner_id = auth.uid());

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

create policy "Users can read group notifications"
  on public.group_notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can update group notifications"
  on public.group_notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can read connection notifications"
  on public.connection_notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can update connection notifications"
  on public.connection_notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

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
