import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
let supabaseUrl = '';
let serviceKey = '';

envFile.split('\n').forEach(line => {
    const cleanLine = line.trim();
    if (cleanLine.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = cleanLine.substring('VITE_SUPABASE_URL='.length).trim();
    if (cleanLine.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) serviceKey = cleanLine.substring('SUPABASE_SERVICE_ROLE_KEY='.length).trim();
});

async function testQuery() {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/classes?select=id,title,date,start_time&order=date.asc`, {
            headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
            }
        });

        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error("Data is not an array:", data);
            return;
        }

        const grouped = {};
        let total = 0;
        data.forEach(cls => {
            if (!grouped[cls.date]) grouped[cls.date] = [];
            grouped[cls.date].push(`${cls.title} (${cls.start_time})`);
            total++;
        });

        console.log(`Total classes: ${total}`);
        for (const [date, classesList] of Object.entries(grouped)) {
            console.log(`\nDate: ${date} (${new Date(date).getDay()})`);
            classesList.forEach(c => console.log(`  - ${c}`));
        }
    } catch (e) {
        console.error(e);
    }
}

testQuery();
