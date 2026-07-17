import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkT() {
  const { data: loans } = await supabase.from('loans').select('id, amount_sanctioned, scheme_name');
  
  for (const loan of loans) {
    const { data: sch } = await supabase.from('collection_schedules').select('amount, week_number').eq('loan_id', loan.id).limit(1);
    if (sch && sch.length > 0) {
      console.log(`Loan: ${loan.amount_sanctioned}, Scheme: ${loan.scheme_name} -> EMI: ${sch[0].amount}`);
    }
  }
}

checkT();
