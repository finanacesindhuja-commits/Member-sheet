import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function fullAnalysis() {
  const { data: loans } = await supabase.from('loans').select('id, amount_sanctioned, scheme_name');
  
  // Group all distinct loan amounts
  const amountSet = new Set(loans.map(l => l.amount_sanctioned));
  console.log('All unique loan amounts:', Array.from(amountSet).sort((a,b)=>a-b));
  
  // For each amount, find max week count and most common EMI
  const schemeMap = {};
  
  for (const loan of loans) {
    const { data: sch } = await supabase
      .from('collection_schedules')
      .select('amount, week_number')
      .eq('loan_id', loan.id);
    
    if (sch && sch.length > 0) {
      const maxWeek = Math.max(...sch.map(s => s.week_number));
      const emi = sch[0].amount;
      const amt = loan.amount_sanctioned;
      
      if (!schemeMap[amt]) schemeMap[amt] = { weeks: maxWeek, emis: {} };
      schemeMap[amt].emis[emi] = (schemeMap[amt].emis[emi] || 0) + 1;
      if (maxWeek > schemeMap[amt].weeks) schemeMap[amt].weeks = maxWeek;
    }
  }
  
  console.log('\n=== STANDARD SCHEME TABLE ===');
  for (const [amount, info] of Object.entries(schemeMap).sort((a,b) => Number(a[0]) - Number(b[0]))) {
    const sortedEmis = Object.entries(info.emis).sort((a,b) => b[1] - a[1]);
    const bestEmi = sortedEmis[0][0];
    const principal = Math.round(Number(amount) / info.weeks);
    const interest = Number(bestEmi) - principal;
    console.log(`₹${amount} | ${info.weeks} weeks | EMI: ₹${bestEmi} | Principal/wk: ₹${principal} | Interest/wk: ₹${interest}`);
  }
  
  // Also check loans with no schedules
  console.log('\n=== LOANS WITH NO SCHEDULES ===');
  for (const loan of loans) {
    const { data: sch } = await supabase.from('collection_schedules').select('id').eq('loan_id', loan.id).limit(1);
    if (!sch || sch.length === 0) {
      console.log(`Loan ID: ${loan.id} | Amount: ₹${loan.amount_sanctioned} | Scheme: ${loan.scheme_name}`);
    }
  }
}

fullAnalysis();
