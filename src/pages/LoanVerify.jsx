import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FaCheckCircle, FaLock, FaCalendarAlt, FaUser, FaShieldAlt, FaRupeeSign, FaPhone } from 'react-icons/fa';

export default function LoanVerify() {
  const { loanId } = useParams();
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLoanDetails();
  }, [loanId]);

  const calculatePenalty = (scheduledDate, scheduleStatus) => {
    const cleanStatus = scheduleStatus ? String(scheduleStatus).trim() : '';
    if (['Paid', 'Verified', 'Received'].includes(cleanStatus)) return 0;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayObj = new Date(todayStr);
    const schedObj = new Date(scheduledDate);
    const diffDays = Math.floor((todayObj - schedObj) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays * 20 : 0;
  };

  const fetchLoanDetails = async () => {
    try {
      setError(null);
      const LOAN_SELECT = 'id, member_name, status, member_id, member_photo_url, amount_sanctioned, credited_at, created_at, mobile_no, nominee_mobile, center_id';

      let loanData = null;
      let loanError = null;
      const cleanId = (loanId || '').trim();

      // 1. First try treating loanId as a member_no
      const { data: memberData } = await supabase
        .from('members')
        .select('id, member_no')
        .ilike('member_no', cleanId)
        .maybeSingle();

      if (memberData) {
        // Look for active/disbursed loan first
        let { data, error } = await supabase
          .from('loans')
          .select(LOAN_SELECT)
          .eq('member_id', memberData.id)
          .not('credited_at', 'is', null)
          .order('credited_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) {
          const res = await supabase
            .from('loans')
            .select(LOAN_SELECT)
            .eq('member_id', memberData.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          data = res.data;
          error = res.error;
        }

        loanData = data;
        loanError = error;
      }

      // 2. If not found by member_no, try integer ID (direct loan id first)
      if (!loanData && !isNaN(cleanId) && cleanId !== '') {
        const numericId = parseInt(cleanId, 10);
        // Try direct loan id
        let { data, error } = await supabase
          .from('loans')
          .select(LOAN_SELECT)
          .eq('id', numericId)
          .maybeSingle();

        if (!data) {
          // Try member_id with latest disbursed loan
          const res = await supabase
            .from('loans')
            .select(LOAN_SELECT)
            .eq('member_id', numericId)
            .not('credited_at', 'is', null)
            .order('credited_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          data = res.data;
          error = res.error;
        }

        loanData = data;
        loanError = error || loanError;
      }

      // 3. If still not found, try UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
      if (!loanData && isUUID) {
        const { data, error } = await supabase
          .from('loans')
          .select(LOAN_SELECT)
          .or(`id.eq.${cleanId},member_id.eq.${cleanId}`)
          .maybeSingle();
        loanData = data;
        loanError = error || loanError;
      }

      // 4. If still not found, try search by member_name
      if (!loanData) {
        const { data, error } = await supabase
          .from('loans')
          .select(LOAN_SELECT)
          .ilike('member_name', cleanId)
          .order('credited_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          loanData = data;
          loanError = error;
        }
      }

      if (loanError && !loanData) {
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
        const { data: memberData } = await supabase
          .from('members')
          .select('member_no')
          .eq('id', loanData.member_id)
          .maybeSingle();

        if (memberData?.member_no) {
          memberNo = memberData.member_no;
        }
      }

      // Fetch schedules without 'penalty' column (penalty is calculated dynamically)
      let { data: scheduleData, error: schError } = await supabase
        .from('collection_schedules')
        .select('id, week_number, scheduled_date, amount, status, collected_amount, scheduled_day')
        .or(`loan_id.eq.${loanData.id},and(loan_id.is.null,member_id.eq.${loanData.id})`)
        .order('week_number', { ascending: true });

      if (schError) {
        console.error('Schedule Fetch Error:', schError);
      }

      // Fallback: If 0 schedules found by id, try member_name
      if ((!scheduleData || scheduleData.length === 0) && loanData.member_name) {
        const { data: nameSchedules } = await supabase
          .from('collection_schedules')
          .select('id, week_number, scheduled_date, amount, status, collected_amount, scheduled_day')
          .ilike('member_name', loanData.member_name.trim())
          .order('week_number', { ascending: true });

        if (nameSchedules && nameSchedules.length > 0) {
          scheduleData = nameSchedules;
        }
      }

      // Fallback 2: Generate virtual schedules if database has none
      let fetchedSchedules = scheduleData || [];
      if (fetchedSchedules.length === 0 && loanData.amount_sanctioned) {
        const loanAmt = Number(loanData.amount_sanctioned) || 10000;
        const SCHEME_STANDARDS = {
          10000: { weeks: 12, emi: 1100 },
          11000: { weeks: 15, emi: 1100 },
          12000: { weeks: 16, emi: 1020 },
          13000: { weeks: 18, emi: 990 },
          15000: { weeks: 22, emi: 1000 },
        };
        const standard = SCHEME_STANDARDS[loanAmt] || { weeks: 16, emi: Math.round(loanAmt / 16) };
        const baseDate = loanData.credited_at ? new Date(loanData.credited_at) : new Date();

        fetchedSchedules = Array.from({ length: standard.weeks }, (_, i) => {
          const d = new Date(baseDate);
          d.setDate(d.getDate() + (i + 1) * 7);
          return {
            week_number: i + 1,
            scheduled_date: d.toISOString().split('T')[0],
            amount: standard.emi,
            status: 'Approved'
          };
        });
      }

      setLoan({
        ...loanData,
        member_no: memberNo,
        collection_schedules: fetchedSchedules
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
  today.setHours(0, 0, 0, 0);

  // Accurate Monday to Sunday calculation
  const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const startOfNextWeek = new Date(endOfWeek);
  startOfNextWeek.setDate(endOfWeek.getDate() + 1);
  startOfNextWeek.setHours(0, 0, 0, 0);

  const endOfNextWeek = new Date(startOfNextWeek);
  endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
  endOfNextWeek.setHours(23, 59, 59, 999);

  // 1. First priority: Schedule falling in the current week (Mon-Sun)
  let thisWeekSchedule = schedules.find(s => {
    const d = new Date(s.scheduled_date);
    return d >= startOfWeek && d <= endOfWeek;
  });

  // 2. Second priority: If not in current week, look for the first pending/unpaid installment
  if (!thisWeekSchedule) {
    const unpaid = schedules.filter(s => !['Paid', 'Received', 'Verified'].includes(s.status));
    if (unpaid.length > 0) {
      thisWeekSchedule = unpaid[0];
    } else {
      // 3. Third priority: Next closest upcoming schedule
      const upcoming = schedules.filter(s => new Date(s.scheduled_date) >= today);
      if (upcoming.length > 0) {
        thisWeekSchedule = upcoming.reduce((closest, s) =>
          new Date(s.scheduled_date) < new Date(closest.scheduled_date) ? s : closest
        );
      } else if (schedules.length > 0) {
        thisWeekSchedule = schedules[schedules.length - 1];
      }
    }
  }

  // Next week schedule
  let nextWeekSchedule = schedules.find(s => {
    const d = new Date(s.scheduled_date);
    return d >= startOfNextWeek && d <= endOfNextWeek;
  });

  // If no schedule next week by date range, pick the installment following this week's installment
  if (!nextWeekSchedule && thisWeekSchedule) {
    nextWeekSchedule = schedules.find(s => s.week_number === (thisWeekSchedule.week_number + 1));
  }

  const currentWeek = thisWeekSchedule?.week_number || 1;
  const currentAmount = thisWeekSchedule?.amount || null;
  const currentDate = thisWeekSchedule?.scheduled_date
    ? new Date(thisWeekSchedule.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  const nextAmount = nextWeekSchedule?.amount || null;
  const nextDate = nextWeekSchedule?.scheduled_date
    ? new Date(nextWeekSchedule.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  const totalPenalty = schedules.reduce((sum, s) => sum + calculatePenalty(s.scheduled_date, s.status), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center p-4 font-sans pb-10">
      <div className="w-full max-w-sm">

        {/* Brand Header */}
        <div className="text-center mb-5 pt-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-2xl mb-3 shadow-lg shadow-blue-600/30">
            <FaShieldAlt size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-black text-white uppercase tracking-widest">Sindhuja Finance</h1>
          <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Loan Verification</p>
        </div>

        {/* ===== THIS WEEK & NEXT WEEK - PROMINENT TOP SECTION ===== */}
        <div className="mb-5 space-y-3">

          {/* THIS WEEK - Big Bold Card */}
          {currentAmount ? (
            <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/50 shadow-2xl shadow-emerald-900/40"
              style={{ background: 'linear-gradient(135deg, #052e16 0%, #064e3b 50%, #065f46 100%)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
                style={{ background: 'radial-gradient(circle, #34d399, transparent)', transform: 'translate(30%, -30%)' }} />
              <div className="p-5 relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50"></div>
                  <span className="text-emerald-300 text-[11px] font-black uppercase tracking-[0.2em]">இந்த வாரம் கட்ட வேண்டியது</span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-emerald-400/60 text-[10px] font-bold uppercase">This Week • Week {currentWeek}</p>
                    <p className="text-emerald-300/80 text-xs font-bold mt-0.5">{currentDate}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-emerald-300 text-2xl font-black">₹</span>
                    <span className="text-white text-4xl font-black leading-none">{Number(currentAmount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-700 p-5 text-center text-slate-500 text-sm font-bold">
              No collection scheduled this week
            </div>
          )}

          {/* NEXT WEEK - Bold Card */}
          {nextAmount ? (
            <div className="relative overflow-hidden rounded-3xl border-2 border-amber-500/40 shadow-xl shadow-amber-900/30"
              style={{ background: 'linear-gradient(135deg, #1c1400 0%, #292100 50%, #3d2f00 100%)' }}>
              <div className="absolute top-0 right-0 w-28 h-28 rounded-full opacity-10"
                style={{ background: 'radial-gradient(circle, #fbbf24, transparent)', transform: 'translate(30%, -30%)' }} />
              <div className="p-5 relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                  <span className="text-amber-300 text-[11px] font-black uppercase tracking-[0.2em]">அடுத்த வாரம் கட்ட வேண்டியது</span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-amber-400/60 text-[10px] font-bold uppercase">Next Week • Week {currentWeek + 1}</p>
                    <p className="text-amber-300/80 text-xs font-bold mt-0.5">{nextDate}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-amber-300 text-2xl font-black">₹</span>
                    <span className="text-white text-4xl font-black leading-none">{Number(nextAmount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-700/50 p-4 text-center text-slate-600 text-xs font-bold">
              No collection scheduled next week
            </div>
          )}

          {/* Penalty if any */}
          {totalPenalty > 0 && (
            <div className="relative overflow-hidden rounded-3xl border-2 border-red-500/40 shadow-xl shadow-red-900/30"
              style={{ background: 'linear-gradient(135deg, #1c0000 0%, #2d0000 100%)' }}>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <FaLock className="text-red-400" size={11} />
                  <span className="text-red-300 text-[11px] font-black uppercase tracking-[0.15em]">Pending Penalty</span>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-red-400/60 text-xs font-bold">Total Outstanding</p>
                  <div className="flex items-center gap-1">
                    <span className="text-red-300 text-2xl font-black">₹</span>
                    <span className="text-white text-4xl font-black leading-none">{Number(totalPenalty).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest">Member Details</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        {/* Member Card */}
        <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">

          {/* Photo + Name */}
          <div className="p-5 bg-slate-800/50 border-b border-white/10 flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-blue-500/30 shadow-xl">
                {loan.member_photo_url ? (
                  <img src={loan.member_photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FaUser className="text-slate-600" size={22} />
                )}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center border-3 border-slate-800 text-white shadow-lg">
                <FaCheckCircle size={10} />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">{loan.member_name}</h2>
              <p className="text-blue-400 text-xs font-mono font-bold mt-0.5">{loan.member_no}</p>
              {loan.mobile_no && (
                <p className="text-slate-400 text-[11px] font-bold mt-0.5 flex items-center gap-1">
                  <FaPhone size={8} /> {loan.mobile_no}
                </p>
              )}
            </div>
          </div>

          {/* Info Rows */}
          <div className="divide-y divide-white/5">

            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                <FaRupeeSign size={10} /> Loan Amount
              </div>
              <span className="text-sm font-black text-emerald-400">₹{Number(loan.amount_sanctioned || 0).toLocaleString('en-IN')}</span>
            </div>

            {loan.credited_at && (
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  <FaCalendarAlt size={10} /> Disbursed On
                </div>
                <span className="text-xs font-black text-white">{new Date(loan.credited_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            )}

            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                <FaCalendarAlt size={10} /> Current Week
              </div>
              <span className="text-xs font-black text-white">Week {currentWeek}</span>
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div> Status
              </div>
              {loan.status === 'CLOSED' ? (
                <span className="bg-slate-500/10 text-slate-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-slate-500/20 inline-flex items-center gap-1.5">
                  <FaLock size={7} /> Closed
                </span>
              ) : (
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/20 inline-flex items-center gap-1.5">
                  <FaCheckCircle size={7} /> Active
                </span>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-slate-600 text-[9px] font-bold uppercase tracking-[0.2em]">
            © 2026 Sindhuja Finance. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  );
}
