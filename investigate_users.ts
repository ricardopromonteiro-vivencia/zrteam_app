import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function investigate() {
    console.log("1. Fetching recent users from auth.users...");
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error("Auth Error:", authError);
        return;
    }

    // Sort users by created_at descending
    const sortedUsers = users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const recentUsers = sortedUsers.slice(0, 5); // get top 5 recent

    for (const u of recentUsers) {
        console.log(`\nEvaluating User: ${u.email} (ID: ${u.id})`);

        // Check if exists in profiles
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', u.id)
            .maybeSingle();

        if (profileError) {
            console.error(`  - Profile query error:`, profileError);
        } else if (profile) {
            console.log(`  - Status: Has Profile [Role: ${profile.role}, School: ${profile.school_id || 'None'}, Archived: ${profile.is_archived}]`);
        } else {
            console.log(`  - Status: ❌ NO PROFILE FOUND! This is a ghost account.`);
        }
    }
}

investigate();
