import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing ENV variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, assigned_professor_id, role')
        .eq('role', 'Admin')
        .single();

    if (error) {
        console.error("Error fetching admin profile:", error);
        return;
    }

    console.log("Admin Profile:", data);

    if (data) {
        // try the join
        const { data: joinedData, error: joinError } = await supabase
            .from('profiles')
            .select('id, full_name, assigned_professor:profiles!assigned_professor_id(full_name)')
            .eq('id', data.id)
            .single();

        console.log("Joined Data:", joinedData);
        console.log("Join Error:", joinError);
    }
}

check();
