from pathlib import Path
import re

root = Path(__file__).parent / "migrations"
out = Path(__file__).parent / "CONSOLIDATED_SCHEMA.sql"

files = sorted(root.glob("*.sql"))

header = """-- =============================================================================
-- Ride & Food — CONSOLIDATED SCHEMA (single-run, idempotent)
-- Paste into Supabase SQL Editor and execute once (safe to re-run).
-- Stack: Expo + Supabase + Vercel | 100% TypeScript clients | NO AI objects
-- Covers: markets/zones/multi-currency, dual pricing, profiles+auth trigger,
--         rides/OTP/bids/GPS, food+merged batches, promos, subscriptions,
--         wallet, gamification, support, RLS, realtime publication, RPCs
-- =============================================================================

"""


def make_triggers_idempotent(sql: str) -> str:
    lines = sql.splitlines(keepends=True)
    out_lines: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^(\s*)create\s+trigger\s+(\w+)\s+", line, re.I)
        if m:
            block = line
            j = i
            while j + 1 < len(lines) and not re.search(
                r"\bon\s+((?:public\.)?\w+)", block, re.I
            ):
                j += 1
                block += lines[j]
            on_m = re.search(r"\bon\s+((?:public\.)?\w+)", block, re.I)
            indent, name = m.group(1), m.group(2)
            table = on_m.group(1) if on_m else None
            if table:
                prev = "".join(out_lines[-5:])
                if not re.search(
                    rf"drop\s+trigger\s+if\s+exists\s+{re.escape(name)}\s+on\s+{re.escape(table)}",
                    prev,
                    re.I,
                ):
                    out_lines.append(
                        f"{indent}drop trigger if exists {name} on {table};\n"
                    )
            out_lines.append(line)
            i += 1
            continue
        out_lines.append(line)
        i += 1
    return "".join(out_lines)


def make_policies_idempotent(sql: str) -> str:
    lines = sql.splitlines(keepends=True)
    out_lines: list[str] = []
    for line in lines:
        m = re.match(
            r"^(\s*)create\s+policy\s+(\w+)\s+on\s+((?:public\.)?\w+)",
            line,
            re.I,
        )
        if m:
            indent, name, table = m.group(1), m.group(2), m.group(3)
            prev = "".join(out_lines[-3:])
            if not re.search(
                rf"drop\s+policy\s+if\s+exists\s+{re.escape(name)}\s+on\s+{re.escape(table)}",
                prev,
                re.I,
            ):
                out_lines.append(
                    f"{indent}drop policy if exists {name} on {table};\n"
                )
        out_lines.append(line)
    return "".join(out_lines)


parts: list[str] = [header]
parts.append(
    """-- ---------------------------------------------------------------------------
-- 0) Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";
create extension if not exists "pg_trgm";
-- Optional on hosted Supabase (Dashboard → Database → Extensions):
-- create extension if not exists "pg_cron";

"""
)

for f in files:
    text = f.read_text(encoding="utf-8")
    if f.name.startswith("20260324100000"):
        text = re.sub(r"(?im)^create extension if not exists.*\n", "", text)
        text = re.sub(r"(?im)^-- Ride & Food.*\n", "", text)
        text = re.sub(r"(?im)^-- Optional.*\n", "", text)
        text = re.sub(
            r'(?im)^-- create extension if not exists "pg_cron";\n', "", text
        )
    if f.name.startswith("20260324100600"):
        text = re.sub(
            r"(?is)-- Auto-create profile on signup.*?for each row execute function public\.handle_new_user\(\);\s*",
            "-- (handle_new_user defined later — hardened version)\n",
            text,
        )

    parts.append(f"\n-- ===== BEGIN {f.name} =====\n")
    parts.append(text)
    if not text.endswith("\n"):
        parts.append("\n")
    parts.append(f"-- ===== END {f.name} =====\n")

blob = "".join(parts)
blob = make_triggers_idempotent(blob)
blob = make_policies_idempotent(blob)

old_drivers = """create policy drivers_read on public.drivers for select
  using (id = auth.uid() or public.is_staff());"""
new_drivers = """create policy drivers_read on public.drivers for select
  using (
    id = auth.uid()
    or public.is_staff()
    or exists (
      select 1 from public.rides r
      where r.driver_id = drivers.id
        and r.rider_id = auth.uid()
        and r.status in ('accepted', 'driver_arrived', 'in_progress')
    )
    or exists (
      select 1 from public.food_orders o
      where o.driver_id = drivers.id
        and o.rider_id = auth.uid()
        and o.status in ('accepted', 'preparing', 'ready', 'picked_up')
    )
  );"""
if old_drivers in blob:
    blob = blob.replace(old_drivers, new_drivers)

partner_menu = """
-- Partner menu writes (restaurant owners)
drop policy if exists menu_items_owner_write on public.menu_items;
create policy menu_items_owner_write on public.menu_items for all
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  );
drop policy if exists menu_categories_owner_write on public.menu_categories;
create policy menu_categories_owner_write on public.menu_categories for all
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  );
drop policy if exists menu_variants_owner_write on public.menu_item_variants;
create policy menu_variants_owner_write on public.menu_item_variants for all
  using (
    exists (
      select 1 from public.menu_items mi
      join public.restaurants r on r.id = mi.restaurant_id
      where mi.id = menu_item_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.menu_items mi
      join public.restaurants r on r.id = mi.restaurant_id
      where mi.id = menu_item_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  );
drop policy if exists menu_addons_owner_write on public.menu_addons;
create policy menu_addons_owner_write on public.menu_addons for all
  using (
    exists (
      select 1 from public.menu_items mi
      join public.restaurants r on r.id = mi.restaurant_id
      where mi.id = menu_item_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.menu_items mi
      join public.restaurants r on r.id = mi.restaurant_id
      where mi.id = menu_item_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  );
"""

if "menu_items_owner_write" not in blob:
    blob = blob.replace("-- Admin writes", partner_menu + "\n-- Admin writes")

blob = blob.replace(
    """    coalesce(new.raw_user_meta_data->>'locale', 'vi'),
    nullif(new.raw_user_meta_data->>'market_id', '')::uuid
  )""",
    """    coalesce(new.raw_user_meta_data->>'locale', 'vi'),
    case
      when coalesce(nullif(new.raw_user_meta_data->>'market_id', ''), '') ~* '^[0-9a-f-]{36}$'
        then (new.raw_user_meta_data->>'market_id')::uuid
      else null
    end
  )""",
)

footer = """
-- =============================================================================
-- Done. Verify:
--   select extname from pg_extension where extname in ('postgis','pgcrypto');
--   select tablename from pg_tables where schemaname='public' order by 1;
--   select * from pg_publication_tables where pubname='supabase_realtime';
-- Never put service_role keys in Expo / Vercel client env — anon + RLS only.
-- =============================================================================
"""
blob = blob + footer
blob = re.sub(r"\n{4,}", "\n\n\n", blob)

out.write_text(blob, encoding="utf-8")
print("Wrote", out, "bytes", out.stat().st_size)
print("create trigger", len(re.findall(r"(?i)create trigger", blob)))
print("drop trigger", len(re.findall(r"(?i)drop trigger if exists", blob)))
print("create policy", len(re.findall(r"(?i)create policy", blob)))
print("drop policy", len(re.findall(r"(?i)drop policy if exists", blob)))
print(
    "AI leftovers",
    len(re.findall(r"(?i)\b(openai|llm|embedding|gpt-)\b", blob)),
)
