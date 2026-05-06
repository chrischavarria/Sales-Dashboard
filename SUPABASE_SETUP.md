# Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor and run `supabase-schema.sql`.
3. In Supabase, go to Authentication and create users for management.
4. Go to Project Settings, then API.
5. Copy the Project URL and anon/publishable key into `supabase-config.js`.
6. Commit and push the updated files to GitHub Pages.

The anon key is safe to publish only because Row Level Security is enabled and the policies require signed-in users.
