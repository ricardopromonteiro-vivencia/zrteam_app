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
        .from('classes')
        .select('id, title, date, start_time')
        .order('date', { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    const grouped = {};
    data.forEach(cls => {
        if (!grouped[cls.date]) grouped[cls.date] = [];
        grouped[cls.date].push(cls.title);
    });

    console.log(JSON.stringify(grouped, null, 2));
}

testQuery();
