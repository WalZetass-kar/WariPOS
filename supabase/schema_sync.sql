-- Log mutasi untuk sinkronisasi antar perangkat.
--
-- Server tidak menyimpan angka stok langsung. Server menyimpan mutasi, dan
-- saldo stok dihitung dari penjumlahan mutasi. Dengan begitu dua kasir yang
-- sama-sama offline tidak saling menimpa stok.
create table if not exists public.sync_mutations (
  id          text primary key,
  device_id   text not null,
  entity      text not null,
  entity_id   text not null,
  operation   text not null,
  payload     jsonb not null default '{}'::jsonb,
  delta       numeric,
  updated_at  timestamptz not null default now(),
  received_at timestamptz not null default now()
);

create index if not exists idx_sync_mutations_entity
  on public.sync_mutations (entity, entity_id, updated_at desc);
create index if not exists idx_sync_mutations_received
  on public.sync_mutations (received_at desc);

alter table public.sync_mutations enable row level security;

-- Akses ke log mutasi diberikan lewat service role pada Edge Function,
-- jadi tidak ada policy untuk anon atau authenticated di sini.
