import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('event_registrations')
    .select('id, event_id, user_id');
  console.log('Event regs:', data);
  console.log('Error:', error);
}

run();
