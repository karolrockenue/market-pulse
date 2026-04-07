require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. distribution_channels
    await client.query(`
      CREATE TABLE IF NOT EXISTS distribution_channels (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        agreement_type VARCHAR(50),
        tier VARCHAR(50),
        integration_type VARCHAR(50),
        commission_pct NUMERIC DEFAULT 0,
        contract_expiry DATE,
        notes TEXT,
        added_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. distribution_channel_contacts
    await client.query(`
      CREATE TABLE IF NOT EXISTS distribution_channel_contacts (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER NOT NULL REFERENCES distribution_channels(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(100)
      );
    `);

    // 3. distribution_channel_notes
    await client.query(`
      CREATE TABLE IF NOT EXISTS distribution_channel_notes (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER NOT NULL REFERENCES distribution_channels(id) ON DELETE CASCADE,
        author VARCHAR(100),
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. distribution_hotel_channels
    await client.query(`
      CREATE TABLE IF NOT EXISTS distribution_hotel_channels (
        hotel_id INTEGER NOT NULL,
        channel_id INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'none',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (hotel_id, channel_id)
      );
    `);

    // 5. crm_tasks
    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        hotel_id INTEGER,
        channel_id INTEGER REFERENCES distribution_channels(id) ON DELETE SET NULL,
        assignee VARCHAR(100),
        priority VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(20) DEFAULT 'todo',
        category VARCHAR(50) DEFAULT 'operations',
        due_date DATE,
        tags TEXT[] DEFAULT '{}',
        created_by VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 6. crm_task_comments
    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_task_comments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES crm_tasks(id) ON DELETE CASCADE,
        author VARCHAR(100),
        body TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'comment',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 7. crm_task_subtasks
    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_task_subtasks (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES crm_tasks(id) ON DELETE CASCADE,
        text VARCHAR(500) NOT NULL,
        done BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0
      );
    `);

    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON crm_tasks(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_crm_tasks_assignee ON crm_tasks(assignee);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_crm_tasks_hotel ON crm_tasks(hotel_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_dhc_hotel ON distribution_hotel_channels(hotel_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_dhc_channel ON distribution_hotel_channels(channel_id);');

    // ── SEED DATA ──

    // Seed channels
    const channelSeed = [
      ['Booking.com', 'booking', 'group', 'primary', 'channel_manager', 15, '2027-03-01', null],
      ['Expedia', 'expedia', 'group', 'primary', 'channel_manager', 18, '2026-12-01', null],
      ['Agoda', 'agoda', 'group', 'secondary', 'channel_manager', 15, null, null],
      ['Hotelbeds', 'hotelbeds', 'group', 'secondary', 'direct_api', 20, '2026-09-15', null],
      ['Trip.com', 'trip', 'individual', 'secondary', 'channel_manager', 15, null, null],
      ['HRS', 'hrs', 'group', 'secondary', 'channel_manager', 14, null, null],
      ['Stuba', 'stuba', 'group', 'experimental', 'direct_api', 22, null, null],
      ['WebBeds', 'webbeds', 'group', 'secondary', 'direct_api', 20, null, null],
      ['CN Travel', 'cntravel', 'individual', 'experimental', 'extranet', 12, null, null],
      ['Direct', 'direct', 'direct', 'primary', 'direct_api', 0, null, 'Own website + walk-ins'],
      ['Google Hotels', 'google', 'direct', 'primary', 'meta_search', 0, null, 'Free booking links + PPA campaigns'],
      ['Trivago', 'trivago', 'direct', 'secondary', 'meta_search', 0, null, null],
    ];

    for (const ch of channelSeed) {
      await client.query(`
        INSERT INTO distribution_channels (name, slug, agreement_type, tier, integration_type, commission_pct, contract_expiry, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (slug) DO NOTHING
      `, ch);
    }

    // Get channel IDs by slug for FK references
    const chRows = (await client.query('SELECT id, slug FROM distribution_channels')).rows;
    const chMap = {};
    chRows.forEach(r => chMap[r.slug] = r.id);

    // Seed contacts
    const contactSeed = [
      [chMap['booking'], 'Sarah Mitchell', 'Market Manager — London', 's.mitchell@booking.com', '+44 20 7946 0958'],
      [chMap['booking'], 'David Park', 'Connectivity Support', 'd.park@booking.com', null],
      [chMap['expedia'], 'James Liu', 'Partner Success', 'j.liu@expediagroup.com', null],
      [chMap['agoda'], 'Priya Sharma', 'Regional Account Manager', 'priya.s@agoda.com', null],
      [chMap['hotelbeds'], 'Carlos Vega', 'Wholesale Manager', 'c.vega@hotelbeds.com', '+34 971 780 000'],
      [chMap['hotelbeds'], 'Lisa Chen', 'Tech Integration', 'l.chen@hotelbeds.com', null],
      [chMap['stuba'], 'Tom Henley', 'UK Sales', 't.henley@stuba.com', null],
    ];

    for (const c of contactSeed) {
      await client.query(`
        INSERT INTO distribution_channel_contacts (channel_id, name, role, email, phone)
        VALUES ($1, $2, $3, $4, $5)
      `, c);
    }

    // Seed internal notes
    const noteSeed = [
      [chMap['booking'], 'Karol', 'Renegotiated commission from 17% to 15% in Jan 2025. Next review due Q1 2027.', '2025-01-20'],
      [chMap['hotelbeds'], 'Karol', 'Commission is high at 20% — push for 18% at next renewal.', '2025-03-10'],
    ];

    for (const n of noteSeed) {
      await client.query(`
        INSERT INTO distribution_channel_notes (channel_id, author, body, created_at)
        VALUES ($1, $2, $3, $4)
      `, n);
    }

    // Seed hotel×channel grid
    // Get all managed hotel IDs by name
    const hotelNames = [
      'The Portico Hotel', 'The W14 Hotel', 'House of Toby', 'The 29 London',
      'Astor Victoria', 'Jubilee Hotel Victoria', 'The Cleveland Hotel', 'The Melita',
      'Vilenza Hotel', 'Camden Suites', 'City Rooms', 'London Homes (Aldgate)',
      'The Whitechapel Hotel', 'Citygate', 'Elysee Hyde Park', 'Notting Hill House Hotel',
      'The Jade Hotel', 'Whitechapel Grand', 'London Suites', 'Studio 169',
      'Lancaster Court Hotel',
    ];

    const hotelRows = (await client.query(
      `SELECT hotel_id, property_name FROM hotels WHERE property_name = ANY($1::text[])`,
      [hotelNames]
    )).rows;
    const hotelMap = {};
    hotelRows.forEach(r => hotelMap[r.property_name] = r.hotel_id);

    // Build grid using same deterministic algorithm as the frontend mock
    const channelSlugs = ['booking', 'expedia', 'agoda', 'hotelbeds', 'trip', 'hrs', 'stuba', 'webbeds', 'cntravel', 'direct', 'google', 'trivago'];
    const pool_statuses = ['live', 'live', 'live', 'live', 'onboarding', 'suspended', 'none', 'none'];

    for (let hi = 0; hi < hotelNames.length; hi++) {
      const hotelId = hotelMap[hotelNames[hi]];
      if (!hotelId) continue;
      for (let ci = 0; ci < channelSlugs.length; ci++) {
        const channelId = chMap[channelSlugs[ci]];
        if (!channelId) continue;
        let status;
        if (channelSlugs[ci] === 'direct') {
          status = 'live';
        } else {
          status = pool_statuses[(hi * 7 + ci * 5) % pool_statuses.length];
        }
        await client.query(`
          INSERT INTO distribution_hotel_channels (hotel_id, channel_id, status)
          VALUES ($1, $2, $3)
          ON CONFLICT (hotel_id, channel_id) DO NOTHING
        `, [hotelId, channelId, status]);
      }
    }

    await client.query('COMMIT');
    console.log('Migration complete: distribution_channels, distribution_channel_contacts, distribution_channel_notes, distribution_hotel_channels, crm_tasks, crm_task_comments, crm_task_subtasks created and seeded (channels, contacts, notes, hotel×channel grid seeded).');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
