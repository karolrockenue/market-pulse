require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. agent_state — per-hotel agent memory
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_state (
        hotel_id INTEGER PRIMARY KEY REFERENCES hotels(hotel_id) ON DELETE CASCADE,
        last_research_at TIMESTAMPTZ,
        last_study_generated_at TIMESTAMPTZ,
        last_outreach_drafted_at TIMESTAMPTZ,
        last_outreach_sent_at TIMESTAMPTZ,
        last_reply_received_at TIMESTAMPTZ,
        research_status VARCHAR(30),
        research_failure_reason TEXT,
        research_failure_count INTEGER DEFAULT 0,
        state_blob JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`DROP TRIGGER IF EXISTS trg_agent_state_updated_at ON agent_state;`);
    await client.query(`
      CREATE TRIGGER trg_agent_state_updated_at
        BEFORE UPDATE ON agent_state
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);

    // 2. sales_outreach_drafts — approval queue
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_outreach_drafts (
        id BIGSERIAL PRIMARY KEY,
        hotel_id INTEGER NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
        person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        channel VARCHAR(20) NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'awaiting_approval',
        drafted_by VARCHAR(100) NOT NULL,
        drafting_model VARCHAR(50),
        drafting_prompt_version VARCHAR(20),
        drafted_at TIMESTAMPTZ DEFAULT NOW(),
        reviewed_by VARCHAR(100),
        reviewed_at TIMESTAMPTZ,
        review_decision_reason TEXT,
        sent_at TIMESTAMPTZ,
        send_provider VARCHAR(30),
        send_provider_message_id TEXT,
        metadata JSONB DEFAULT '{}'::jsonb
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_drafts_status_drafted
        ON sales_outreach_drafts(status, drafted_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_drafts_hotel
        ON sales_outreach_drafts(hotel_id, drafted_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_drafts_awaiting
        ON sales_outreach_drafts(drafted_at DESC)
        WHERE status = 'awaiting_approval';
    `);

    // 3. agent_run_log — audit + observability
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_run_log (
        id BIGSERIAL PRIMARY KEY,
        agent_name VARCHAR(50) NOT NULL,
        run_id UUID NOT NULL,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        ended_at TIMESTAMPTZ,
        status VARCHAR(20),
        trigger_type VARCHAR(30),
        trigger_payload JSONB,
        hotel_id INTEGER REFERENCES hotels(hotel_id) ON DELETE SET NULL,
        model_used VARCHAR(50),
        tokens_in INTEGER,
        tokens_out INTEGER,
        cost_gbp NUMERIC(10,4),
        error_message TEXT,
        output_summary TEXT
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_run_log_agent_started
        ON agent_run_log(agent_name, started_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_run_log_run_id
        ON agent_run_log(run_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_run_log_hotel
        ON agent_run_log(hotel_id, started_at DESC)
        WHERE hotel_id IS NOT NULL;
    `);

    // 4. agent_telegram_messages — bot state
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_telegram_messages (
        id BIGSERIAL PRIMARY KEY,
        telegram_chat_id BIGINT NOT NULL,
        telegram_message_id BIGINT,
        direction VARCHAR(10) NOT NULL,
        message_type VARCHAR(30),
        ref_table VARCHAR(50),
        ref_id BIGINT,
        body TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_chat_created
        ON agent_telegram_messages(telegram_chat_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_ref
        ON agent_telegram_messages(ref_table, ref_id)
        WHERE ref_table IS NOT NULL;
    `);

    await client.query('COMMIT');
    console.log('[migration_019] Created 4 agent infra tables: agent_state, sales_outreach_drafts, agent_run_log, agent_telegram_messages (+ trigger + 8 indexes)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration_019] Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
