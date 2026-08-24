-- Бесплатный общий каталог продуктов, заполненный пользователями.
-- В каталог попадают только продукты, которые пользователь создал вручную.
create table if not exists food_barcode_catalog (
  barcode text primary key,
  name text not null,
  brand text,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  fat numeric not null default 0,
  carbs numeric not null default 0,
  fiber numeric not null default 0,
  serving_size text not null default '100 г',
  category text not null default 'other',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table food_barcode_catalog enable row level security;

drop policy if exists "food_barcode_catalog_read" on food_barcode_catalog;
create policy "food_barcode_catalog_read" on food_barcode_catalog
  for select to anon, authenticated using (true);

drop policy if exists "food_barcode_catalog_insert" on food_barcode_catalog;
create policy "food_barcode_catalog_insert" on food_barcode_catalog
  for insert to anon, authenticated with check (
    length(barcode) between 8 and 14
    and name <> ''
    and kcal between 0 and 1000
    and protein between 0 and 100
    and fat between 0 and 100
    and carbs between 0 and 100
    and fiber between 0 and 100
  );

grant select, insert on table food_barcode_catalog to anon, authenticated;
