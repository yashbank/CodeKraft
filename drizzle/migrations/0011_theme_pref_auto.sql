-- P14-12b: per-user theme choice gains "auto" (follow the OS colour scheme). Additive enum value.
ALTER TYPE "public"."theme_pref" ADD VALUE IF NOT EXISTS 'auto';
