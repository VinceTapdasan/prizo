-- Run this in Supabase SQL editor
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_business_id ON activity_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_customer_id ON activity_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);

-- RLS: superadmin only via service role key (backend handles this)
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (NestJS uses service role key)
CREATE POLICY "service_role_all" ON activity_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
