-- Sera Otomasyon: kullanıcı girişi ve veri senkronu
-- Kullanıcı adı, Supabase Auth'ta "<kullanici>@sera.local" e-postası olarak tutulur.
-- Hesapları yalnızca yönetici açar (e-posta doğrulaması gerekmez).

create extension if not exists pgcrypto with schema extensions;

-- ---------- Profiller ----------
create table public.profiller (
  id uuid primary key references auth.users (id) on delete cascade,
  kullanici_adi text not null unique,
  ad text not null,
  rol text not null default 'personel' check (rol in ('yonetici', 'personel')),
  aktif boolean not null default true,
  son_gorulme timestamptz,
  olusturma timestamptz not null default now()
);
alter table public.profiller enable row level security;

-- ---------- Paylaşılan veri (parça başına bir satır) ----------
-- anahtar: 'k:<bölüm>' (seralar, personel, …) veya 'gun:YYYY-MM-DD'
-- veri null ise parça silinmiştir.
create table public.sera_veri (
  anahtar text primary key,
  veri jsonb,
  guncelleme timestamptz not null default now(),
  guncelleyen uuid references auth.users (id) on delete set null
);
create index sera_veri_guncelleme on public.sera_veri (guncelleme);
alter table public.sera_veri enable row level security;

-- ---------- Yardımcılar ----------
create or replace function public.aktif_kullanici()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiller where id = auth.uid() and aktif);
$$;

create or replace function public.yonetici_mi()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiller where id = auth.uid() and aktif and rol = 'yonetici');
$$;

create or replace function public.sera_veri_damga()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.guncelleme := clock_timestamp();
  new.guncelleyen := auth.uid();
  return new;
end;
$$;
create trigger sera_veri_damga before insert or update on public.sera_veri
  for each row execute function public.sera_veri_damga();

-- ---------- Erişim kuralları ----------
create policy "aktif okur" on public.profiller for select to authenticated using ((select public.aktif_kullanici()));
create policy "aktif okur" on public.sera_veri for select to authenticated using ((select public.aktif_kullanici()));
create policy "aktif ekler" on public.sera_veri for insert to authenticated with check ((select public.aktif_kullanici()));
create policy "aktif günceller" on public.sera_veri for update to authenticated
  using ((select public.aktif_kullanici())) with check ((select public.aktif_kullanici()));

-- ---------- Hesap işlemleri ----------
create or replace function public._kullanici_olustur(p_kullanici text, p_sifre text, p_ad text, p_rol text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  v_k text := lower(trim(p_kullanici));
  v_eposta text;
begin
  if v_k !~ '^[a-z0-9._-]{3,32}$' then
    raise exception 'Kullanıcı adı 3-32 karakter olmalı (harf, rakam, . _ -)';
  end if;
  if length(coalesce(p_sifre, '')) < 6 then
    raise exception 'Şifre en az 6 karakter olmalı';
  end if;
  if exists (select 1 from public.profiller where kullanici_adi = v_k) then
    raise exception 'Bu kullanıcı adı zaten var';
  end if;
  v_eposta := v_k || '@sera.local';
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_eposta,
    extensions.crypt(p_sifre, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('ad', p_ad), now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_eposta, 'email_verified', true),
    'email', now(), now(), now());
  insert into public.profiller (id, kullanici_adi, ad, rol)
  values (v_id, v_k, coalesce(nullif(trim(p_ad), ''), v_k), p_rol);
  return v_id;
end;
$$;
revoke all on function public._kullanici_olustur(text, text, text, text) from public, anon, authenticated;

-- Kurulum yapılmış mı? (giriş ekranı ilk yönetici formunu göstermek için)
-- Yönetici kendini kapatamadığı için kurulumdan sonra en az bir aktif hesap hep kalır.
create or replace function public.kurulum_var()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiller where aktif);
$$;

-- Hiç kullanıcı yokken ilk yönetici hesabını açar
create or replace function public.ilk_yonetici(p_kullanici text, p_sifre text, p_ad text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  lock table public.profiller in exclusive mode;
  if exists (select 1 from public.profiller where aktif) then
    raise exception 'Kurulum zaten yapılmış';
  end if;
  return public._kullanici_olustur(p_kullanici, p_sifre, p_ad, 'yonetici');
end;
$$;

create or replace function public.kullanici_ekle(p_kullanici text, p_sifre text, p_ad text, p_rol text default 'personel')
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not public.yonetici_mi() then raise exception 'Yetkiniz yok'; end if;
  if p_rol not in ('yonetici', 'personel') then raise exception 'Geçersiz rol'; end if;
  return public._kullanici_olustur(p_kullanici, p_sifre, p_ad, p_rol);
end;
$$;

create or replace function public.kullanici_guncelle(p_id uuid, p_ad text default null, p_rol text default null, p_aktif boolean default null, p_sifre text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.yonetici_mi() then raise exception 'Yetkiniz yok'; end if;
  if p_id = auth.uid() and (p_aktif = false or p_rol = 'personel') then
    raise exception 'Kendi yöneticiliğinizi kaldıramazsınız';
  end if;
  if p_rol is not null and p_rol not in ('yonetici', 'personel') then raise exception 'Geçersiz rol'; end if;
  if p_sifre is not null then
    if length(p_sifre) < 6 then raise exception 'Şifre en az 6 karakter olmalı'; end if;
    update auth.users set encrypted_password = extensions.crypt(p_sifre, extensions.gen_salt('bf')), updated_at = now() where id = p_id;
  end if;
  update public.profiller set
    ad = coalesce(nullif(trim(p_ad), ''), ad),
    rol = coalesce(p_rol, rol),
    aktif = coalesce(p_aktif, aktif)
  where id = p_id;
end;
$$;

-- "Son görülme" zamanı
create or replace function public.gorundum()
returns void language sql security definer set search_path = '' as $$
  update public.profiller set son_gorulme = now() where id = auth.uid();
$$;

revoke all on function public.kurulum_var() from public;
revoke all on function public.ilk_yonetici(text, text, text) from public;
revoke all on function public.kullanici_ekle(text, text, text, text) from public, anon;
revoke all on function public.kullanici_guncelle(uuid, text, text, boolean, text) from public, anon;
revoke all on function public.gorundum() from public, anon;
revoke all on function public.aktif_kullanici() from public, anon;
revoke all on function public.yonetici_mi() from public, anon;
grant execute on function public.kurulum_var() to anon, authenticated;
grant execute on function public.ilk_yonetici(text, text, text) to anon, authenticated;
grant execute on function public.kullanici_ekle(text, text, text, text) to authenticated;
grant execute on function public.kullanici_guncelle(uuid, text, text, boolean, text) to authenticated;
grant execute on function public.gorundum() to authenticated;
grant execute on function public.aktif_kullanici() to authenticated;
grant execute on function public.yonetici_mi() to authenticated;

-- Anlık güncelleme (başka telefonda yapılan değişiklik hemen gelsin)
alter publication supabase_realtime add table public.sera_veri;
