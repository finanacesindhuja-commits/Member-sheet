import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function test(loanId) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(loanId);
  const LOAN_SELECT = 'id, member_name, status, member_id, member_photo_url, amount_sanctioned, credited_at, created_at, mobile_no, nominee_mobile, center_id';
  let loanData = null, loanError = null;

  if (isUUID) {
    console.log("It's UUID");
  } else {
    console.log("Searching member_no:", loanId);
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('id')
      .ilike('member_no', loanId.trim())
      .maybeSingle();

    console.log('Member lookup:', memberData, memberError);

    if (memberError) {
      loanError = memberError;
    } else if (memberData) {
      const { data, error } = await supabase
        .from('loans')
        .select(LOAN_SELECT)
        .eq('member_id', memberData.id)
        .in('status', ['DISBURSED', 'ARCHIVED', 'ACTIVE', 'CLOSED', 'Disbursed', 'Archived', 'Active', 'Closed'])
        .order('credited_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      loanData = data;
      loanError = error;
      console.log('Loan lookup via member_id:', loanData, loanError);
    } else {
      const { data, error } = await supabase
        .from('loans')
        .select(LOAN_SELECT + ', members!inner(member_no)')
        .ilike('members.member_no', loanId.trim())
        .maybeSingle();
      loanData = data;
      loanError = error;
      console.log('Loan lookup via direct:', loanData, loanError);
    }
  }
}

test('LN-640800');
