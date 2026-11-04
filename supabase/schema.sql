-- Run once in Supabase SQL Editor before adding an admin user.
create table if not exists public.store_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business text not null default 'shared' check (business in ('shared', 'tiffin', 'products')),
  created_at timestamptz not null default now()
);

alter table public.store_admins add column if not exists business text not null default 'shared';
alter table public.store_admins drop constraint if exists store_admins_pkey;
alter table public.store_admins add primary key (user_id, business);

create or replace function public.is_store_admin(target_business text default null)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.store_admins
    where user_id = auth.uid()
      and (target_business is null or business = target_business or business = 'shared' or target_business = 'shared')
  );
$$;
revoke all on function public.is_store_admin(text) from public, anon;
grant execute on function public.is_store_admin(text) to authenticated;
revoke all on table public.store_admins from anon, authenticated;

create table if not exists public.menu_items (
  id text primary key,
  name text not null,
  description text not null default '',
  portion text not null default '',
  price numeric(10,2) not null default 0 check (price >= 0),
  emoji text not null default '🍱',
  image_url text not null default '',
  addons jsonb not null default '[]'::jsonb,
  available boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null default 'Other packaged food',
  description text not null default '',
  ingredients text not null default '',
  emoji text not null default '🫙',
  image_url text not null default '',
  variants jsonb not null default '[]'::jsonb,
  stock integer not null default 0 check (stock >= 0),
  available boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.website_content (
  business text not null check (business in ('shared', 'tiffin', 'products')),
  content_key text not null,
  content_value text not null default '',
  updated_at timestamptz not null default now(),
  primary key (business, content_key)
);

insert into public.website_content (business, content_key, content_value) values
  ('shared', 'home_kicker', 'JAIN FAMILY FOODS'),
  ('shared', 'home_title', E'Jain Tiffin\nand Sudhasagar Ji Products.'),
  ('shared', 'home_text', 'Choose Jain Tiffin to see the meal menu, or browse the packaged foods from Sudhasagar Ji Products.'),
  ('shared', 'home_image', ''),
  ('shared', 'story_title', 'Jain Family Foods'),
  ('shared', 'story_text', 'Jain Tiffin and Sudhasagar Ji Products are two family businesses with their own menus, products and storefronts. Get in touch if you need help choosing where to start.'),
  ('shared', 'story_image', ''),
  ('shared', 'contact_title', 'Ask about a meal or product.'),
  ('shared', 'contact_text', 'Choose which business you’re contacting. Your message will open in WhatsApp so you can review and send it.'),
  ('shared', 'contact_whatsapp', ''),
  ('tiffin', 'hero_title', E'A meal for\nthe day ahead.'),
  ('tiffin', 'hero_text', 'Check the current Jain Tiffin menu, choose what you need and send an order enquiry.'),
  ('tiffin', 'hero_image', ''),
  ('tiffin', 'home_title', 'Jain Tiffin'),
  ('tiffin', 'home_text', 'See the current meal menu and send an order enquiry.'),
  ('tiffin', 'card_image', ''),
  ('tiffin', 'story_title', 'Jain Tiffin'),
  ('tiffin', 'story_text', 'A daily meal service with a current menu available on this page.'),
  ('tiffin', 'story_image', ''),
  ('products', 'hero_title', E'Pantry foods\nfrom Sudhasagar Ji.'),
  ('products', 'hero_text', 'Browse the current range, check pack details and add products to your cart.'),
  ('products', 'hero_image', ''),
  ('products', 'home_title', 'Sudhasagar Ji Products'),
  ('products', 'home_text', 'Browse the current range of pantry products, pack sizes and availability.'),
  ('products', 'card_image', ''),
  ('products', 'story_title', 'Sudhasagar Ji Products'),
  ('products', 'story_text', 'Part of Jain Family Foods, Sudhasagar Ji Products is a separate storefront for packaged food products.'),
  ('products', 'story_image', '')
on conflict (business, content_key) do nothing;

alter table public.menu_items enable row level security;
alter table public.products enable row level security;
alter table public.website_content enable row level security;
grant select on public.menu_items, public.products to anon, authenticated;
grant insert, update, delete on public.menu_items, public.products to authenticated;
grant select on public.website_content to anon, authenticated;
grant insert, update, delete on public.website_content to authenticated;

drop policy if exists "Public can view available menu" on public.menu_items;
create policy "Public can view available menu" on public.menu_items
  for select to anon, authenticated using (available);
drop policy if exists "Admins manage menu" on public.menu_items;
create policy "Admins manage menu" on public.menu_items
  for all to authenticated using ((select public.is_store_admin('tiffin'))) with check ((select public.is_store_admin('tiffin')));

drop policy if exists "Public can view available products" on public.products;
create policy "Public can view available products" on public.products
  for select to anon, authenticated using (available);
drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products
  for all to authenticated using ((select public.is_store_admin('products'))) with check ((select public.is_store_admin('products')));

drop policy if exists "Public can view website content" on public.website_content;
create policy "Public can view website content" on public.website_content
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage website content" on public.website_content;
create policy "Admins manage website content" on public.website_content
  for all to authenticated using (
    (business = 'shared' and ((select public.is_store_admin('tiffin')) or (select public.is_store_admin('products'))))
    or (business = 'tiffin' and (select public.is_store_admin('tiffin')))
    or (business = 'products' and (select public.is_store_admin('products')))
  ) with check (
    (business = 'shared' and ((select public.is_store_admin('tiffin')) or (select public.is_store_admin('products'))))
    or (business = 'tiffin' and (select public.is_store_admin('tiffin')))
    or (business = 'products' and (select public.is_store_admin('products')))
  );

insert into storage.buckets (id, name, public)
values ('store-media', 'store-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can view store images" on storage.objects;
create policy "Public can view store images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'store-media');
drop policy if exists "Admins upload store images" on storage.objects;
create policy "Admins upload store images" on storage.objects
  for insert to authenticated with check (bucket_id = 'store-media' and (
    (name like 'tiffin/%' and (select public.is_store_admin('tiffin')))
    or (name like 'products/%' and (select public.is_store_admin('products')))
  ));
drop policy if exists "Admins update store images" on storage.objects;
create policy "Admins update store images" on storage.objects
  for update to authenticated using (bucket_id = 'store-media' and (
    (name like 'tiffin/%' and (select public.is_store_admin('tiffin')))
    or (name like 'products/%' and (select public.is_store_admin('products')))
  ))
  with check (bucket_id = 'store-media' and (
    (name like 'tiffin/%' and (select public.is_store_admin('tiffin')))
    or (name like 'products/%' and (select public.is_store_admin('products')))
  ));
drop policy if exists "Admins delete store images" on storage.objects;
create policy "Admins delete store images" on storage.objects
  for delete to authenticated using (bucket_id = 'store-media' and (
    (name like 'tiffin/%' and (select public.is_store_admin('tiffin')))
    or (name like 'products/%' and (select public.is_store_admin('products')))
  ));

