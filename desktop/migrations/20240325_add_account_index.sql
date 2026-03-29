-- Migration: Add account_index column to existing tables
-- Version: 20240325_add_account_index
-- Purpose: Support multi-account isolation by adding account_index to all account-scoped tables

-- Add account_index to signing_history table
ALTER TABLE signing_history ADD COLUMN account_index INTEGER DEFAULT 0;

-- Add account_index to security_events table (if exists)
-- ALTER TABLE security_events ADD COLUMN account_index INTEGER DEFAULT 0;

-- Add account_index to desktop_contacts table
ALTER TABLE desktop_contacts ADD COLUMN account_index INTEGER DEFAULT 0;

-- Add account_index to transaction_sync table
ALTER TABLE transaction_sync ADD COLUMN account_index INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_signing_history_account ON signing_history(account_index);
CREATE INDEX IF NOT EXISTS idx_contacts_account ON desktop_contacts(account_index);
CREATE INDEX IF NOT EXISTS idx_tx_sync_account ON transaction_sync(account_index);

-- Note: accounts table is created by AccountManager on first use
-- This migration assumes default account (index 0) for all existing data
