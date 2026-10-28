import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20261028110000_reminders_notifications_and_price_checks.sql"), "utf8");

describe("reminders and price checks migration contract", () => {
  it("is additive and keeps inbox, delivery, and check rows owner-scoped", () => {
    expect(migration).not.toMatch(/\bdrop\s+table\b/i);
    expect(migration).toMatch(/create table if not exists public\.notifications/i);
    expect(migration).toMatch(/unique\s*\(user_id,\s*event_key\)/i);
    expect(migration).toMatch(/create table if not exists public\.notification_deliveries/i);
    expect(migration).toMatch(/unique \(id, user_id\)[\s\S]*unique \(user_id, event_key\)/i);
    expect(migration).toMatch(/foreign key \(notification_id, user_id\) references public\.notifications \(id, user_id\)/i);
    expect(migration).toMatch(/create table if not exists public\.price_watch_checks/i);
    expect(migration).toMatch(/foreign key \(price_watch_id, user_id\) references public\.price_watches \(id, user_id\)/i);
  });

  it("keeps system-generated reminder and verified-price writes behind restricted functions", () => {
    expect(migration).toMatch(/create or replace function public\.create_coverage_expiry_reminders/i);
    expect(migration).toMatch(/grant execute on function public\.create_coverage_expiry_reminders[^;]+to authenticated/i);
    expect(migration).toMatch(/create or replace function public\.record_verified_price_watch_observation/i);
    expect(migration).toMatch(/grant execute on function public\.record_verified_price_watch_observation[^;]+to service_role/i);
    expect(migration).toMatch(/grant update \(read_at\) on public\.notifications to authenticated/i);
    expect(migration).toMatch(/now\(\),\s*p_check_key,\s*true\s*\)/i);
  });

  it("limits manual data changes and disables automatic client writes to price history", () => {
    expect(migration).toMatch(/grant execute on function public\.record_manual_price_watch_observation[^;]+to authenticated/i);
    expect(migration).toMatch(/revoke insert, update, delete on public\.price_observations from anon, authenticated/i);
    expect(migration).toMatch(/grant update \(remind_at, reason, title, status, completed_at\) on public\.reminders to authenticated/i);
    expect(migration).toMatch(/add column if not exists source_verified boolean not null default false/i);
  });
});
