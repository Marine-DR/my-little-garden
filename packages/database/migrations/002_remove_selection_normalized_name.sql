PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE;

CREATE TABLE selections_without_normalized_name (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL CHECK (
        length(trim(name)) > 0 AND name = trim(name)
    ),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT uq_selections_name UNIQUE (name)
);

INSERT INTO selections_without_normalized_name (
    id, name, created_at, updated_at
)
SELECT id, name, created_at, updated_at
FROM selections;

DROP TABLE selections;

ALTER TABLE selections_without_normalized_name RENAME TO selections;

COMMIT;

PRAGMA foreign_keys = ON;
