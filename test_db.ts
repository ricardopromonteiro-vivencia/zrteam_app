import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceKey);

async function testQuery() {
    const { data, error } = await supabase
        .from('classes')
        .select('id, title, date, start_time')
        .order('date', { ascending: true });

    if (error) {
        console.error("Error:", error);
        return;
    }

    const grouped: any = {};
    let total = 0;
    data.forEach(cls => {
        if (!grouped[cls.date]) grouped[cls.date] = [];
        grouped[cls.date].push(`${cls.title} (${cls.start_time})`);
        total++;
    });

    console.log(`Total classes: ${total}`);
    for (const [date, classesList] of Object.entries(grouped)) {
        console.log(`\nDate: ${date} (${new Date(date).getDay()})`);
        (classesList as string[]).forEach((c: string) => console.log(`  - ${c}`));
    }
}

testQuery();
