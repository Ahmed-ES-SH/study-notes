-- Migration 003: Full-Text Search (FTS5) for Notes with Sync Triggers
--
-- `notes_fts` is an external-content FTS5 table backed by the `notes` table:
-- the index never stores a second copy of the text, and the three triggers
-- below keep it consistent with `notes` inside the same atomic transaction
-- as every INSERT / UPDATE / DELETE issued by the app.

-- 1. Create FTS5 Virtual Table
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    id UNINDEXED,
    title,
    content,
    content='notes',
    content_rowid='rowid',
    tokenize='porter unicode61'
);

-- 2. Populate FTS Index with Existing Notes
INSERT INTO notes_fts(rowid, id, title, content)
SELECT rowid, id, title, content FROM notes;

-- 3. Trigger: Keep FTS in sync after INSERT
CREATE TRIGGER IF NOT EXISTS notes_fts_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, id, title, content)
    VALUES (new.rowid, new.id, new.title, new.content);
END;

-- 4. Trigger: Keep FTS in sync after UPDATE
CREATE TRIGGER IF NOT EXISTS notes_fts_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, id, title, content)
    VALUES ('delete', old.rowid, old.id, old.title, old.content);
    INSERT INTO notes_fts(rowid, id, title, content)
    VALUES (new.rowid, new.id, new.title, new.content);
END;

-- 5. Trigger: Keep FTS in sync after DELETE
CREATE TRIGGER IF NOT EXISTS notes_fts_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, id, title, content)
    VALUES ('delete', old.rowid, old.id, old.title, old.content);
END;
