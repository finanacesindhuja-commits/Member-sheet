import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FaCheckCircle, FaLock, FaCalendarAlt, FaUser, FaHashtag } from 'react-icons/fa';

export default function LoanVerify() {
  const { loanId } = useParams();
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLoanDetails();
  }, [loanId]);

  const fetchLoanDetails = async () => {
    try {
      setError(null);
      // Try matching the ID in the URL against either the internal 'id' or the 'loan_app_id'
      const { data, error: fetchError } = await supabase
        .from('loans')
        .select(`
          member_name, 
          status, 
          loan_app_id, 
          collection_schedules(week_number, scheduled_date, amount)
        `)
        .or(`id.eq.${loanId},loan_app_id.eq.${loanId}`)
        .maybeSingle();
      
      if (fetchError) {
        console.error('Fetch Error:', fetchError);
        setError(`${fetchError.message} (${fetchError.code})`);
        return;
      }

      if (!data) {
        setError('Success. No rows returned - This means the ID scanned doesn\'t exist in the database.');
        return;
      }

      setLoan(data);
    } catch (err) {
      console.error('Error fetching loan details:', err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="bg-slate-900 border border-red-500/20 p-8 rounded-3xl max-w-sm">
          <p className="text-red-400 font-bold">Verification Error</p>
          <p className="text-slate-500 text-sm mt-2">{error || 'Loan information not found.'}</p>
          <p className="text-slate-600 text-[10px] mt-4 font-mono break-all">ID: {loanId}</p>
        </div>
      </div>
    );
  }

  // Determine current week based on date
  const schedules = loan.collection_schedules || [];
  const today = new Date();
  
  // Find the latest week that is either today or in the past
  const pastSchedules = schedules.filter(s => new Date(s.scheduled_date) <= today);
  const currentWeek = pastSchedules.length > 0 
    ? Math.max(...pastSchedules.map(s => s.week_number)) 
    : 1;

  return (
    <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white uppercase tracking-[0.2em]">Sindhuja Finance</h1>
          <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Verification System</p>
        </div>

        {/* Info Table Card */}
        <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="p-8 bg-slate-800/50 border-b border-white/10 text-center">
             <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                <FaCheckCircle className="text-blue-400 text-3xl" />
             </div>
             <h2 className="text-lg font-black text-white uppercase tracking-widest">Loan Authenticated</h2>
          </div>

          <div className="p-0">
            <table className="w-full border-collapse">
              <tbody className="divide-y divide-white/5">
                <tr className="hover:bg-white/[0.02]">
                  <td className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                    <FaUser size={12} /> Name
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-white uppercase text-right">
                    {loan.member_name}
                  </td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                    <FaHashtag size={12} /> LN Number
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-blue-400 font-mono text-right">
                    {loan.loan_app_id || 'N/A'}
                  </td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div> Status
                  </td>
                  <td className="px-8 py-5 text-right">
                    {loan.status === 'CLOSED' ? (
                      <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/20 inline-flex items-center gap-2">
                        <FaLock size={8} /> Closed
                      </span>
                    ) : (
                      <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-blue-500/20 inline-flex items-center gap-2">
                        <FaCheckCircle size={8} /> Active
                      </span>
                    )}
                  </td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                    <FaCalendarAlt size={12} /> Week Info
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-white text-right">
                    Week {currentWeek}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-8 bg-slate-900/50 text-center">
            <p className="text-slate-500 text-[8px] font-bold uppercase tracking-[0.2em]">
              © 2026 Sindhuja Finance Management. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
