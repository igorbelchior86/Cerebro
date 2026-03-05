-- Migration: Ticket Intake Tables for Tickets

CREATE TABLE IF NOT EXISTS tickets_raw (
    message_id VARCHAR(255) PRIMARY KEY,
    email_data JSONB NOT NULL,
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets_processed (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    requester VARCHAR(255),
    source VARCHAR(50) DEFAULT 'ticket_intake',
    status VARCHAR(50) DEFAULT 'new',
    raw_body TEXT,
    is_reply BOOLEAN DEFAULT FALSE,
    updates JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
