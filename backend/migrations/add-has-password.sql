ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS has_password boolean NOT NULL DEFAULT false;
