import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS rich_media_embeds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT,
    media_type ENUM('video','audio','image','document','shopping','chart','link_preview') NOT NULL,
    source VARCHAR(500) NOT NULL,
    title VARCHAR(300),
    thumbnail_url VARCHAR(500),
    start_time INT,
    end_time INT,
    metadata JSON,
    relevance_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rich_media_message (message_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ad_placements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    placement_type ENUM('contextual_banner','sponsored_content','product_recommendation','inline_cta') NOT NULL,
    advertiser_name VARCHAR(200),
    target_context VARCHAR(200),
    content_html TEXT,
    cta_url VARCHAR(500),
    cta_text VARCHAR(100),
    impressions INT DEFAULT 0,
    clicks INT DEFAULT 0,
    enabled TINYINT(1) DEFAULT 1,
    max_impressions INT,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ad_impression_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ad_id INT NOT NULL,
    user_id INT,
    session_id VARCHAR(100),
    event_type ENUM('impression','click','dismiss') NOT NULL,
    context VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ad_impression_ad (ad_id),
    INDEX idx_ad_impression_user (user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS video_streaming_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    conversation_id INT,
    stream_type ENUM('screen_share','camera','co_browse') NOT NULL,
    stream_status ENUM('connecting','active','paused','ended') DEFAULT 'connecting',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    transcript_text TEXT,
    ai_responses_during_stream INT DEFAULT 0
  )`,
];

for (const sql of statements) {
  const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
  try {
    await conn.query(sql);
    console.log(`✓ ${tableName} created/verified`);
  } catch (e) {
    console.error(`✗ ${tableName}: ${e.message}`);
  }
}

await conn.end();
console.log("Done.");
