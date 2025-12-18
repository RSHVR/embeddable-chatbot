-- Supabase Migration: SMS Notification System
-- Run this in your Supabase SQL Editor or as a migration file
--
-- This creates the pending_sms table for two-way SMS communication
-- between the chatbot agent and business owner via Twilio.

-- =============================================================================
-- PENDING SMS TABLE
-- =============================================================================
-- Tracks SMS messages sent to the business owner and their replies

CREATE TABLE IF NOT EXISTS pending_sms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  tool_use_id TEXT NOT NULL,
  message_to_owner TEXT NOT NULL,
  owner_reply TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  replied_at TIMESTAMPTZ,
  conversation_context JSONB,

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'replied', 'timeout'))
);

-- Index for fast session lookups
CREATE INDEX IF NOT EXISTS idx_pending_sms_session ON pending_sms(session_id);

-- Partial index for pending messages (most common query)
CREATE INDEX IF NOT EXISTS idx_pending_sms_pending ON pending_sms(status, created_at DESC)
  WHERE status = 'pending';

-- Index for checking replies
CREATE INDEX IF NOT EXISTS idx_pending_sms_replied ON pending_sms(session_id, replied_at DESC)
  WHERE status = 'replied';

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
-- Enable RLS on the table
ALTER TABLE pending_sms ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access (for server-side operations)
-- The service role key bypasses RLS by default, but this makes it explicit
CREATE POLICY "Service role has full access to pending_sms"
  ON pending_sms
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Deny all access to anonymous users
-- SMS data should only be accessed server-side
CREATE POLICY "Deny anonymous access to pending_sms"
  ON pending_sms
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Policy: Deny all access to authenticated users (unless you want user-specific access)
-- Uncomment and modify if you need authenticated user access
-- CREATE POLICY "Authenticated users can view their own SMS"
--   ON pending_sms
--   FOR SELECT
--   TO authenticated
--   USING (auth.uid()::text = session_id);

-- =============================================================================
-- CHATS TABLE (if not already created)
-- =============================================================================
-- This table stores chat history for session persistence

CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_chats_session_id ON chats(session_id);

-- Enable RLS on chats table
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role has full access to chats"
  ON chats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Deny anonymous access
CREATE POLICY "Deny anonymous access to chats"
  ON chats
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- HELPER FUNCTION: Clean up old pending SMS (optional)
-- =============================================================================
-- Run periodically to clean up stale pending messages

CREATE OR REPLACE FUNCTION cleanup_stale_pending_sms(older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM pending_sms
    WHERE status = 'pending'
      AND created_at < NOW() - (older_than_hours || ' hours')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

-- Grant execute to service role only
REVOKE ALL ON FUNCTION cleanup_stale_pending_sms FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_stale_pending_sms TO service_role;
