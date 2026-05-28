-- Users & Auth (расширение profiles)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  role text check (role in ('user','coach','doctor','admin')) default 'user',
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users read own profile" on profiles for select using (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);
create policy "Admins read all" on profiles for select using (role = 'admin');

-- Labs
create table labs_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  code text not null,
  name text not null,
  value numeric not null,
  unit text not null,
  date date not null,
  phase text not null,
  source text default 'manual',
  updated_at timestamptz default now()
);
create index idx_labs_user_date on labs_log(user_id, date desc);
alter table labs_log enable row level security;
create policy "Users CRUD own labs" on labs_log for all using (auth.uid() = user_id);

-- Nutrition
create table nutrition_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  date date not null,
  total jsonb not null,
  items jsonb default '[]',
  updated_at timestamptz default now()
);
create index idx_nutrition_user_date on nutrition_log(user_id, date desc);
alter table nutrition_log enable row level security;
create policy "Users CRUD own nutrition" on nutrition_log for all using (auth.uid() = user_id);

-- Diagnostics
create table diagnostics_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  type text not null,
  findings text,
  key_metrics jsonb default '{}',
  date date not null,
  phase text not null,
  images text[] default '{}',
  updated_at timestamptz default now()
);
create index idx_dx_user_date on diagnostics_log(user_id, date desc);
alter table diagnostics_log enable row level security;
create policy "Users CRUD own diagnostics" on diagnostics_log for all using (auth.uid() = user_id);

-- Articles
create table articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) not null,
  title text not null,
  content text,
  teaser text,
  tags text[] default '{}',
  category text check (category in ('training','nutrition','pharma','labs','pct','general')),
  status text check (status in ('draft','review','published','archived')) default 'draft',
  version integer default 1,
  likes integer default 0,
  views integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  published_at timestamptz
);
create index idx_articles_status on articles(status);
create index idx_articles_author on articles(author_id);
alter table articles enable row level security;
create policy "Users CRUD own articles" on articles for all using (auth.uid() = author_id);
create policy "Doctors review articles" on articles for update using (role = 'doctor' or role = 'admin');
create policy "Public read published" on articles for select using (status = 'published');

-- Auto updated_at trigger
create or replace function trigger_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on profiles for each row execute procedure trigger_set_updated_at();
create trigger set_updated_at before update on labs_log for each row execute procedure trigger_set_updated_at();
create trigger set_updated_at before update on nutrition_log for each row execute procedure trigger_set_updated_at();
create trigger set_updated_at before update on diagnostics_log for each row execute procedure trigger_set_updated_at();
create trigger set_updated_at before update on articles for each row execute procedure trigger_set_updated_at();