CREATE TABLE services (
  id uuid PRIMARY KEY, owner text NOT NULL, name text NOT NULL, category text NOT NULL, phone text NOT NULL,
  breakfast integer NOT NULL, lunch integer NOT NULL, dinner integer NOT NULL,
  archived boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
  CONSTRAINT prices_nonnegative CHECK (breakfast >= 0 AND lunch >= 0 AND dinner >= 0)
);
CREATE INDEX services_owner_idx ON services(owner);
CREATE TABLE payments (
  id uuid PRIMARY KEY, request_id uuid NOT NULL UNIQUE, service_id uuid NOT NULL REFERENCES services(id),
  amount integer NOT NULL CHECK (amount >= 0), cutoff date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), reversed_at timestamptz
);
CREATE TABLE meals (
  id uuid PRIMARY KEY, service_id uuid NOT NULL REFERENCES services(id), day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('breakfast','lunch','dinner','custom')), label text NOT NULL,
  amount integer NOT NULL CHECK (amount >= 0), payment_id uuid REFERENCES payments(id), version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX standard_meal_slot ON meals(service_id, day, kind) WHERE kind <> 'custom';
CREATE INDEX meals_service_day_idx ON meals(service_id, day);
CREATE TABLE payment_items (
  id uuid PRIMARY KEY, payment_id uuid NOT NULL REFERENCES payments(id), meal_id uuid NOT NULL,
  day date NOT NULL, label text NOT NULL, amount integer NOT NULL CHECK (amount >= 0)
);
