CREATE TABLE accounts (
  google_id text PRIMARY KEY,
  owner_key text NOT NULL UNIQUE,
  email text NOT NULL,
  name text
);
