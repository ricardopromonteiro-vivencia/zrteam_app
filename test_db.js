import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

envFile.split('\n').forEach(line => {
    if (line.trim().startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
    if (line.trim().startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, belt, assigned_professor_id, assigned_professor:profiles!assigned_professor_id(full_name)')
        .ilike('full_name', 'Monteiro');

    console.log("EXACT MATCH MONTEIRO:");
    if (data) data.forEach(p => console.log(p));
    if (error) console.error(error);
}

testQuery();
