import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FaCheckCircle, FaLock, FaCalendarAlt, FaUser, FaHashtag, FaShieldAlt, FaRupeeSign } from 'react-icons/fa';

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
      let loanData = null;
      let loanError = null;

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(loanId);

      if (isUUID) {
        const { data, error } = await supabase
          .from('loans')
          .select('id, member_name, status, member_id, member_photo_url')
          .or(`id.eq.${loanId},member_id.eq.${loanId}`)
          .maybeSingle();
        loanData = data;
        loanError = error;
      } else {
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('id')
          .ilike('member_no', loanId.trim())
          .maybeSingle();

        if (memberError) {
          loanError = memberError;
        } else if (memberData) {
          const { data, error } = await supabase
            .from('loans')
            .select('id, member_name, status, member_id, member_photo_url')
            .eq('member_id', memberData.id)
            .maybeSingle();
          loanData = data;
          loanError = error;
        }
      }

      if (loanError) {
        console.error('Loan Fetch Error:', loanError);
        setError(`${loanError.message} (${loanError.code})`);
        return;
      }

      if (!loanData) {
        setError('No loan record found for this ID.');
        return;
      }

      let memberNo = 'N/A';
      if (loanData.member_id) {
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('member_no')
          .eq('id', loanData.member_id)
          .maybeSingle();

        if (!memberError && memberData) {
          memberNo = memberData.member_no;
        }
      }

      const { data: scheduleData, error: schError } = await supabase
        .from('collection_schedules')
        .select('week_number, scheduled_date, amount')
        .eq('member_id', loanData.id)
        .order('week_number', { ascending: true });

      if (schError) {
        console.error('Schedule Fetch Error:', schError);
      }

      setLoan({
        ...loanData,
        member_no: memberNo,
        collection_schedules: scheduleData || []
      });
    } catch (err) {
      console.error('Error fetching loan details:', err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Verifying...</p>
        </div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-red-500/20 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FaShieldAlt className="text-red-400" size={28} />
          </div>
          <p className="text-red-400 font-black text-lg uppercase tracking-wide">Verification Failed</p>
          <p className="text-slate-500 text-sm mt-2">{error || 'Loan information not found.'}</p>
          <p className="text-slate-600 text-[10px] mt-4 font-mono break-all">ID: {loanId}</p>
        </div>
      </div>
    );
  }

  const schedules = loan.collection_schedules || [];
  const today = new Date();
  const pastSchedules = schedules.filter(s => new Date(s.scheduled_date) <= today);
  const currentWeek = pastSchedules.length > 0
    ? Math.max(...pastSchedules.map(s => s.week_number))
    : 1;
  const nextWeekSchedule = schedules.find(s => s.week_number === currentWeek + 1);
  const nextAmount = nextWeekSchedule?.amount || null;
  const nextDate = nextWeekSchedule?.scheduled_date
    ? new Date(nextWeekSchedule.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm">

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-2xl mb-3 shadow-lg shadow-blue-600/30">
            <FaShieldAlt size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-black text-white uppercase tracking-widest">Sindhuja Finance</h1>
          <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Verification System</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">

          {/* Photo + Name */}
          <div className="p-6 bg-slate-800/50 border-b border-white/10 flex flex-col items-center text-center gap-3">
            <div className="relative">
              <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-blue-500/30 shadow-xl">
                {loan.member_photo_url ? (
                  <img src={loan.member_photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FaUser className="text-slate-600" size={28} />
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-blue-600 rounded-xl flex items-center justify-center border-4 border-slate-800 text-white shadow-lg">
                <FaCheckCircle size={12} />
              </div>
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-widest">{loan.member_name}</h2>
              <p className="text-blue-400 text-xs font-mono font-bold mt-0.5">{loan.member_no}</p>
            </div>
          </div>

          {/* Info Rows */}
          <div className="divide-y divide-white/5">

            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-black uppercase tracking-widest">
                <FaHashtag size={11} /> Member No
              </div>
              <span className="text-sm font-black text-blue-400 font-mono">{loan.member_no || 'N/A'}</span>
            </div>

            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-black uppercase tracking-widest">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div> Status
              </div>
              {loan.status === 'CLOSED' ? (
                <span className="bg-slate-500/10 text-slate-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-slate-500/20 inline-flex items-center gap-2">
                  <FaLock size={8} /> Closed
                </span>
              ) : (
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/20 inline-flex items-center gap-2">
                  <FaCheckCircle size={8} /> Active
                </span>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-black uppercase tracking-widest">
                <FaCalendarAlt size={11} /> Current Week
              </div>
              <span className="text-sm font-black text-white">Week {currentWeek}</span>
            </div>

            {nextAmount && (
              <div className="mx-4 my-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                  <FaCalendarAlt size={10} /> Next Week Due (Week {currentWeek + 1})
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs font-bold">{nextDate}</span>
                  <span className="text-amber-400 text-xl font-black flex items-center gap-1">
                    <FaRupeeSign size={14} />{Number(nextAmount).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-900/50 text-center">
            <p className="text-slate-600 text-[9px] font-bold uppercase tracking-[0.2em]">
              © 2026 Sindhuja Finance. All rights reserved.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
