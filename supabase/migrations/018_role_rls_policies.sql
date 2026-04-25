-- Migration 018 — Add RLS policies for role_dictionary and role_specialty_map
-- These tables need public read access for the anon key (used by the browser).

ALTER TABLE role_dictionary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON role_dictionary FOR SELECT USING (true);

ALTER TABLE role_specialty_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON role_specialty_map FOR SELECT USING (true);
