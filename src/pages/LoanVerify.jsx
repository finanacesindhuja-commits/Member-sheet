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

      if (loanError) { setError(`${loanError.message}`); return; }
      if (!loanData) { setError('No loan record found for this ID.'); return; }

      let memberNo = 'N/A';
      if (loanData.member_id) {
        const { data: memberData } = await supabase
          .from('members').select('member_no').eq('id', loanData.member_id).maybeSingle();
        if (memberData) memberNo = memberData.member_no;
      }

      const { data: scheduleData } = await supabase
        .from('collection_schedules')
        .select('week_number, scheduled_date, amount')
        .eq('member_id', loanData.id)
        .order('week_number', { ascending: true });

      setLoan({ ...loanData, member_no: memberNo, collection_schedules: scheduleData || [] });
    } catch (err) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loaderWrap}>
          <div style={styles.spinner}></div>
          <p style={styles.loaderText}>Verifying...</p>
        </div>
        <style>{spinnerCSS}</style>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, maxWidth: 360, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#f87171', fontWeight: 900, fontSize: 16, textTransform: 'uppercase', letterSpacing: 2 }}>Verification Failed</p>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>{error || 'Record not found.'}</p>
        </div>
      </div>
    );
  }

  const schedules = loan.collection_schedules || [];
  const today = new Date();
  const pastSchedules = schedules.filter(s => new Date(s.scheduled_date) <= today);
  const currentWeek = pastSchedules.length > 0 ? Math.max(...pastSchedules.map(s => s.week_number)) : 1;
  const currentWeekSchedule = schedules.find(s => s.week_number === currentWeek);
  const currentAmount = currentWeekSchedule?.amount || null;
  const currentDate = currentWeekSchedule?.scheduled_date
    ? new Date(currentWeekSchedule.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  const nextWeekSchedule = schedules.find(s => s.week_number === currentWeek + 1);
  const nextAmount = nextWeekSchedule?.amount || null;
  const nextDate = nextWeekSchedule?.scheduled_date
    ? new Date(nextWeekSchedule.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <div style={styles.page}>
      <style>{animCSS}</style>

      {/* Glow blobs */}
      <div style={styles.blob1}></div>
      <div style={styles.blob2}></div>

      <div style={styles.container}>

        {/* Top Brand */}
        <div style={styles.brand}>
          <div>
            <p style={styles.brandName}>Welcome to Sindhuja Finance</p>
            <p style={styles.brandSub}>Loan Verification System</p>
          </div>
        </div>

        {/* Main Card */}
        <div style={styles.card}>

          {/* Name Header */}
          <div style={styles.photoHeader}>
            <div style={styles.photoWrap}>
              {loan.member_photo_url
                ? <img src={loan.member_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }} />
                : <FaUser size={32} color="#475569" />}
            </div>
            <h2 style={styles.memberName}>{loan.member_name}</h2>
            {loan.status === 'CLOSED'
              ? <div style={{ ...styles.statusChip, background: 'rgba(100,116,139,0.15)', color: '#94a3b8', borderColor: 'rgba(100,116,139,0.3)' }}>
                  <FaLock size={9} /> Closed
                </div>
              : <div style={styles.statusChip}>
                  <span style={styles.activeDot}></span> Active Loan
                </div>}
          </div>

          {/* Info Rows */}
          <div style={styles.infoSection}>
            <div style={styles.infoRow}>
              <div style={styles.infoLabel}><FaCalendarAlt size={11} color="#60a5fa" /> Current Week</div>
              <div style={styles.infoValue}>Week {currentWeek}</div>
            </div>
            <div style={styles.divider}></div>
            <div style={styles.infoRow}>
              <div style={styles.infoLabel}><FaHashtag size={11} color="#60a5fa" /> Member No</div>
              <div style={{ ...styles.infoValue, color: '#60a5fa', fontFamily: 'monospace' }}>{loan.member_no || 'N/A'}</div>
            </div>
          </div>

          {/* Current Week Amount */}
          {currentAmount && (
            <div style={styles.currentDueBox}>
              <div style={styles.nextDueTop}>
                <FaRupeeSign size={10} color="#34d399" />
                <span style={{ ...styles.nextDueLabel, color: '#34d399' }}>This Week — Week {currentWeek}</span>
              </div>
              <div style={styles.nextDueRow}>
                <span style={styles.nextDueDate}>{currentDate}</span>
                <span style={{ ...styles.nextDueAmount, color: '#34d399' }}>
                  <FaRupeeSign size={16} />
                  {Number(currentAmount).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          {/* Next Due Box */}
          {nextAmount && (
            <div style={styles.nextDueBox}>
              <div style={styles.nextDueTop}>
                <FaCalendarAlt size={11} color="#fbbf24" />
                <span style={styles.nextDueLabel}>Next Due — Week {currentWeek + 1}</span>
              </div>
              <div style={styles.nextDueRow}>
                <span style={styles.nextDueDate}>{nextDate}</span>
                <span style={styles.nextDueAmount}>
                  <FaRupeeSign size={16} />
                  {Number(nextAmount).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={styles.cardFooter}>
            <p style={styles.footerText}>© 2026 Sindhuja Finance Management</p>
          </div>
        </div>

      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  blob1: {
    position: 'fixed', top: '-20%', left: '-20%',
    width: '50vw', height: '50vw',
    background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none',
  },
  blob2: {
    position: 'fixed', bottom: '-20%', right: '-20%',
    width: '50vw', height: '50vw',
    background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none',
  },
  container: {
    width: '100%', maxWidth: 400,
    display: 'flex', flexDirection: 'column', gap: 20,
    position: 'relative', zIndex: 1,
    animation: 'fadeUp 0.5s ease',
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20, padding: '14px 20px',
    backdropFilter: 'blur(12px)',
  },
  brandIcon: {
    width: 44, height: 44,
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 8px 20px rgba(37,99,235,0.4)',
  },
  brandName: { color: '#fff', fontWeight: 900, fontSize: 16, letterSpacing: 1, margin: 0 },
  brandSub: { color: '#60a5fa', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, margin: 0 },
  card: {
    background: 'rgba(15,23,42,0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 28,
    overflow: 'hidden',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
  },
  photoHeader: {
    padding: '32px 24px 24px',
    background: 'linear-gradient(180deg, rgba(37,99,235,0.1) 0%, transparent 100%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  photoRing: {
    padding: 3,
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    borderRadius: '50%',
    marginBottom: 4,
    position: 'relative',
  },
  photoWrap: {
    width: 88, height: 88,
    background: '#1e293b',
    borderRadius: 20,
    border: '2px solid rgba(59,130,246,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },
  verifiedBadge: {
    marginTop: -18, marginLeft: 64,
    width: 28, height: 28,
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '3px solid #0f172a',
    boxShadow: '0 4px 12px rgba(37,99,235,0.5)',
  },
  memberName: {
    color: '#fff', fontWeight: 900, fontSize: 20,
    textTransform: 'uppercase', letterSpacing: 1, margin: 0,
    textAlign: 'center',
  },
  memberChip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    background: 'rgba(59,130,246,0.1)',
    border: '1px solid rgba(59,130,246,0.25)',
    borderRadius: 20, padding: '4px 14px',
    color: '#60a5fa', fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
  },
  statusChip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: 20, padding: '5px 16px',
    color: '#34d399', fontSize: 11, fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  activeDot: {
    display: 'inline-block',
    width: 7, height: 7,
    borderRadius: '50%',
    background: '#34d399',
    boxShadow: '0 0 6px #34d399',
    animation: 'pulse 1.5s infinite',
  },
  infoSection: {
    padding: '4px 0',
  },
  infoRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 24px',
  },
  infoLabel: {
    display: 'flex', alignItems: 'center', gap: 8,
    color: '#64748b', fontSize: 11, fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  infoValue: {
    color: '#e2e8f0', fontSize: 14, fontWeight: 900,
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.04)',
    margin: '0 24px',
  },
  currentDueBox: {
    margin: '4px 16px 8px',
    background: 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(16,185,129,0.05))',
    border: '1px solid rgba(52,211,153,0.25)',
    borderRadius: 18,
    padding: '16px 20px',
  },
  nextDueBox: {
    margin: '4px 16px 16px',
    background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.05))',
    border: '1px solid rgba(251,191,36,0.25)',
    borderRadius: 18,
    padding: '16px 20px',
  },
  nextDueTop: {
    display: 'flex', alignItems: 'center', gap: 6,
    marginBottom: 10,
  },
  nextDueLabel: {
    color: '#fbbf24', fontSize: 10, fontWeight: 900,
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  nextDueRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  nextDueDate: {
    color: '#94a3b8', fontSize: 12, fontWeight: 700,
  },
  nextDueAmount: {
    color: '#fbbf24', fontSize: 24, fontWeight: 900,
    display: 'flex', alignItems: 'center', gap: 2,
  },
  cardFooter: {
    padding: '14px 24px',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    textAlign: 'center',
    background: 'rgba(0,0,0,0.2)',
  },
  footerText: {
    color: '#334155', fontSize: 9, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 2, margin: 0,
  },
  loaderWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    position: 'relative', zIndex: 1,
  },
  spinner: {
    width: 48, height: 48,
    border: '3px solid rgba(59,130,246,0.15)',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loaderText: {
    color: '#475569', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 3, margin: 0,
  },
};

const spinnerCSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const animCSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  * { box-sizing: border-box; }
  body { margin: 0; }
`;
