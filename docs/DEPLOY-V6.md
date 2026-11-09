# NeoMaker ERP V6

V6 build stabilization: uses the webpack build path instead of Turbopack and marks authenticated app routes as dynamic to avoid build-time Supabase requests.

Keep existing Supabase migrations 001-005. No new database migration is required for this build fix.
