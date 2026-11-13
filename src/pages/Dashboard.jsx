import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaPrint, FaSignOutAlt, FaUsers, FaSearch, FaTimes, FaBuilding, 
  FaSyncAlt, FaTrash, FaHistory, FaStar, FaCalendarAlt 
} from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import PrintableMemberSlip from '../components/PrintableMemberSlip';

export default function Dashboard() {
  const [centers, setCenters] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [memberToPrint, setMemberToPrint] = useState(null);
  const [memberSchedules, setMemberSchedules] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCenterId, setSelectedCenterId] = useState('ALL');
  const [activeView, setActiveView] = useState('recent'); // 'recent' | 'all'
  const [recentFilter, setRecentFilter] = useState('all'); // 'all' | 'new' | 'printed'
  
  const staffId = sessionStorage.getItem('staffId');
  const staffName = sessionStorage.getItem('staffName');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCenters();
  }, []);

  // Real-time subscription to listen for new centers AND new loans
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'centers' },
        () => {
          fetchCenters();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'loans' },
        (payload) => {
          if (payload.new) {
            const newLoan = payload.new;
            setMembers(prev => {
              const exists = prev.some(m => m.id === newLoan.id);
              if (exists) return prev;
              const formatted = {
                ...newLoan,
                amount_sanctioned: Number(newLoan.amount_sanctioned) || 0,
                is_saving_plan: Boolean(newLoan.is_saving_plan) || String(newLoan.scheme_name || '').toLowerCase().includes('saving'),
                saving_per_week: Number(newLoan.saving_per_week) || 0,
                stp_amount: Number(newLoan.stp_amount) || 0,
                total_saving: Number(newLoan.total_saving) || 0,
                _isNew: true
              };
              return [formatted, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [centers]);

  const fetchCenters = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const { data: staffCenters, error } = await supabase
        .from('centers')
        .select('*')
        .ilike('staff_id', staffId)
        .order('name', { ascending: true });
        
      if (error) throw error;
      const fetchedCenters = staffCenters || [];
      setCenters(fetchedCenters);
      
      if (fetchedCenters.length > 0) {
        await fetchAllMembers(fetchedCenters);
      }
    } catch (err) {
      console.error('Error fetching centers:', err);
    } finally {
      if (isManualRefresh) setRefreshing(false);
    }
  };

  const fetchAllMembers = async (centerList) => {
    if (!centerList || centerList.length === 0) return;
    setLoading(true);
    try {
      const centerIds = centerList.map(c => c.id);
      
      // Fetch all loans belonging to the staff's centers
      const { data: membersData, error: memError } = await supabase
        .from('loans')
        .select('member_name, id, member_id, amount_sanctioned, credited_at, created_at, member_photo_url, mobile_no, nominee_mobile, center_id, status, scheme_name, is_saving_plan, saving_per_week, stp_amount, total_saving, members(member_no)')
        .in('center_id', centerIds)
        .order('created_at', { ascending: false });

      if (memError) throw memError;

      const formattedMembers = (membersData || []).map(m => ({
        ...m,
        member_no: m.members?.member_no || null,
        loan_app_id: m.loan_app_id || null,
        amount_sanctioned: Number(m.amount_sanctioned) || 0,
        is_saving_plan: Boolean(m.is_saving_plan) || String(m.scheme_name || '').toLowerCase().includes('saving'),
        saving_per_week: Number(m.saving_per_week) || 0,
        stp_amount: Number(m.stp_amount) || 0,
        total_saving: Number(m.total_saving) || 0
      }));
      
      setMembers(formattedMembers);
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (loanId) => {
    if (!window.confirm('Are you sure you want to delete this member loan? This action cannot be undone.')) return;
    
    try {
      const { error } = await supabase
        .from('loans')
        .update({ status: 'ARCHIVED' })
        .eq('id', loanId);
        
      if (error) throw error;
      
      // Update local state
      setMembers(prev => prev.map(m => m.id === loanId ? { ...m, status: 'ARCHIVED' } : m));
      alert('Member marked as deleted.');
    } catch (err) {
      console.error('Error archiving member:', err);
      alert('Failed to delete member.');
    }
  };

  const handlePreview = async (member) => {
    setPreviewLoading(true);
    try {
      // Fetch schedules based on the loan ID
      const { data, error } = await supabase
        .from('collection_schedules')
        .select('scheduled_date, amount, week_number, scheduled_day, emi_amount, saving_amount, plan_name')
        .or(`loan_id.eq.${member.id},and(loan_id.is.null,member_id.eq.${member.id})`)
        .order('week_number', { ascending: true });
        
      if (error) throw error;
      const fetchedSchedules = data || [];
      
      setMemberSchedules(fetchedSchedules);
      setMemberToPrint(member);
      setShowPreview(true);

      // Record printed status in localStorage
      const printedIds = JSON.parse(localStorage.getItem('printed_loans') || '[]');
      if (!printedIds.includes(member.id)) {
        printedIds.push(member.id);
        localStorage.setItem('printed_loans', JSON.stringify(printedIds));
        setMembers(prev => prev.map(m => 
          m.id === member.id ? { ...m, _printed: true } : m
        ));
      }

    } catch (err) {
      console.error(err);
      alert('Failed to load schedules for this member.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const executePrint = () => {
    window.print();
  };

  const closePreview = () => {
    setShowPreview(false);
    setMemberToPrint(null);
    setMemberSchedules([]);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('staffId');
    sessionStorage.removeItem('staffName');
    navigate('/login');
  };

  const handleResetPrintHistory = () => {
    if (window.confirm('Reset viewed/printed history? All recently added members will show with the "NEW" badge again.')) {
      localStorage.removeItem('printed_loans');
      setMembers(prev => prev.map(m => ({ ...m, _printed: false })));
    }
  };

  const centerName = centers.find(c => c.id === memberToPrint?.center_id)?.name || '';

  const renderMemberRow = (member) => {
    const printedIds = JSON.parse(localStorage.getItem('printed_loans') || '[]');
    const isPrinted = member._printed || printedIds.includes(member.id);
    const memberDate = member.created_at || member.credited_at;
    const isRecentlyCreated = member._isNew || (memberDate && new Date(memberDate) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    return (
      <div 
        key={member.id} 
        className={`p-6 flex flex-col md:flex-row items-start md:items-center justify-between hover:bg-white/5 transition-all gap-4 ${
          (!isPrinted && isRecentlyCreated) ? 'bg-green-500/5' : ''
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
             {member.member_photo_url ? (
               <img src={member.member_photo_url} alt="" className="w-full h-full object-cover" />
             ) : <FaUsers className="text-slate-500" size={24} />}
          </div>
          <div className="flex-1">
            <h3 className="font-black text-white text-lg uppercase tracking-tight flex flex-wrap items-center gap-2">
              {member.member_name}
              
              {!isPrinted && isRecentlyCreated && (
                <span className="bg-green-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest shadow-lg shadow-green-500/20">
                  NEW
                </span>
              )}

              {isPrinted && (
                <span className="bg-blue-500/20 text-blue-300 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border border-blue-500/30">
                  SLIP READY
                </span>
              )}

              {member.status && member.status !== 'DISBURSED' && member.status !== 'ARCHIVED' && (
                <span className="bg-amber-500/20 text-amber-300 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border border-amber-500/30">
                  {member.status}
                </span>
              )}

              {member.status === 'ARCHIVED' && (
                <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest shadow-lg shadow-red-500/20">
                  DELETED
                </span>
              )}

              {member.is_saving_plan && (
                <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border border-emerald-500/30 flex items-center gap-1">
                  💰 SAVING ({member.saving_per_week ? `₹${member.saving_per_week}/wk` : '₹100/wk'})
                </span>
              )}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-slate-400 text-xs font-mono font-bold bg-slate-800/50 px-2 py-1 rounded-md border border-white/5">
                ID: {member.member_no || member.id}
              </span>
              {member.mobile_no && (
                <span className="text-slate-300 text-xs font-bold bg-slate-800/50 px-2 py-1 rounded-md border border-white/5 flex items-center gap-1">
                  📞 {member.mobile_no}
                </span>
              )}
              {member.amount_sanctioned ? (
                <span className="text-blue-400 text-xs font-black bg-blue-900/20 px-2 py-1 rounded-md border border-blue-500/20">
                  ₹{member.amount_sanctioned.toLocaleString()}
                </span>
              ) : null}
              {member.is_saving_plan && (
                <span className="text-emerald-400 text-xs font-black bg-emerald-900/20 px-2 py-1 rounded-md border border-emerald-500/20">
                  {member.scheme_name || '15 Wks Saving'}
                </span>
              )}
              {member.created_at && (
                <span className="text-slate-400 text-[10px] font-medium">
                  {new Date(member.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => handlePreview(member)}
            disabled={previewLoading}
            className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-500/20 cursor-pointer"
          >
            <FaPrint size={14} /> Preview
          </button>
          {member.status !== 'ARCHIVED' ? (
            <button 
              onClick={() => handleDeleteMember(member.id)}
              className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 cursor-pointer"
              title="Delete Member"
            >
              <FaTrash size={12} />
            </button>
          ) : (
            <button 
              disabled
              className="bg-slate-500/10 text-slate-500 border border-slate-500/20 px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3"
              title="Already Deleted"
            >
              Deleted
            </button>
          )}
        </div>
      </div>
    );
  };

  const getCenterSearchString = (c) => {
    return [
      c.name,
      `${c.name || ''} Center`,
      `Center ${c.name || ''}`,
      c.center_name,
      c.center_no,
      `Center ${c.center_no || ''}`,
      c.code,
      c.area,
      c.village,
      c.place,
      String(c.id || '')
    ].filter(Boolean).join(' ').toLowerCase();
  };

  const getMemberSearchString = (m, center) => {
    return [
      m.member_name,
      m.member_no,
      String(m.id || ''),
      String(m.mobile_no || ''),
      String(m.nominee_mobile || ''),
      String(m.amount_sanctioned || ''),
      m.scheme_name,
      m.is_saving_plan ? 'saving plan savings' : '',
      center?.name,
      `${center?.name || ''} Center`,
      center?.center_no,
      center?.code
    ].filter(Boolean).join(' ').toLowerCase();
  };

  const getFilteredCenterGroups = () => {
    const rawQ = searchQuery.trim().toLowerCase();
    const qTokens = rawQ ? rawQ.split(/[\s,/-]+/).filter(Boolean) : [];

    return centers
      .filter(center => {
        if (selectedCenterId !== 'ALL' && String(center.id) !== String(selectedCenterId)) {
          return false;
        }
        return true;
      })
      .map(center => {
        const centerSearchText = getCenterSearchString(center);
        const isCenterMatch = qTokens.length > 0 && qTokens.every(token => centerSearchText.includes(token));

        const centerMembers = members.filter(m => m.center_id === center.id);

        const filteredMembers = isCenterMatch
          ? centerMembers
          : centerMembers.filter(m => {
              if (qTokens.length === 0) return true;
              const memText = getMemberSearchString(m, center);
              return qTokens.every(token => memText.includes(token));
            });

        const sortedMembers = [...filteredMembers].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : (a.credited_at ? new Date(a.credited_at).getTime() : 0);
          const dateB = b.created_at ? new Date(b.created_at).getTime() : (b.credited_at ? new Date(b.credited_at).getTime() : 0);
          const validA = isNaN(dateA) ? 0 : dateA;
          const validB = isNaN(dateB) ? 0 : dateB;
          if (validA === validB) {
            const noA = parseInt(String(a.member_no || '').replace(/\D/g, '')) || 0;
            const noB = parseInt(String(b.member_no || '').replace(/\D/g, '')) || 0;
            return noB - noA;
          }
          return validB - validA;
        });

        return {
          center,
          members: sortedMembers,
          isCenterMatch,
          totalCenterMembers: centerMembers.length
        };
      })
      .filter(group => {
        if (qTokens.length > 0 || selectedCenterId !== 'ALL') {
          return group.members.length > 0 || group.isCenterMatch;
        }
        return group.members.length > 0;
      });
  };

  const getRecentMembers = () => {
    const printedIds = JSON.parse(localStorage.getItem('printed_loans') || '[]');
    
    // Sort all active/non-archived members by creation date descending
    const activeMembers = members.filter(m => m.status !== 'ARCHIVED');

    const sorted = [...activeMembers].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : (a.credited_at ? new Date(a.credited_at).getTime() : 0);
      const dateB = b.created_at ? new Date(b.created_at).getTime() : (b.credited_at ? new Date(b.credited_at).getTime() : 0);
      const validA = isNaN(dateA) ? 0 : dateA;
      const validB = isNaN(dateB) ? 0 : dateB;
      if (validA === validB) {
        const noA = parseInt(String(a.member_no || '').replace(/\D/g, '')) || 0;
        const noB = parseInt(String(b.member_no || '').replace(/\D/g, '')) || 0;
        return noB - noA;
      }
      return validB - validA;
    });

    return sorted.filter(member => {
      const isPrinted = member._printed || printedIds.includes(member.id);
      if (recentFilter === 'new') {
        return !isPrinted;
      }
      if (recentFilter === 'printed') {
        return isPrinted;
      }
      return true;
    });
  };

  // Sort centers for Recent view: most recently created centers first!
  const getRecentCenters = () => {
    return [...centers].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      const validA = isNaN(dateA) ? 0 : dateA;
      const validB = isNaN(dateB) ? 0 : dateB;
      if (validA === validB) {
        return (b.id || 0) - (a.id || 0); // Higher ID = newer center
      }
      return validB - validA;
    });
  };

  const recentMembers = getRecentMembers();
  const recentCenters = getRecentCenters();
  const filteredCenterGroups = getFilteredCenterGroups();
  const totalFilteredMembers = filteredCenterGroups.reduce((acc, g) => acc + g.members.length, 0);
  const isSearchOrFilterActive = Boolean(searchQuery.trim() || selectedCenterId !== 'ALL');
  
  const printedCount = members.filter(m => {
    const printedIds = JSON.parse(localStorage.getItem('printed_loans') || '[]');
    return (m._printed || printedIds.includes(m.id)) && m.status !== 'ARCHIVED';
  }).length;
  const newCount = members.filter(m => {
    const printedIds = JSON.parse(localStorage.getItem('printed_loans') || '[]');
    return !m._printed && !printedIds.includes(m.id) && m.status !== 'ARCHIVED';
  }).length;

  // Check if a center is newly created (e.g. within 30 days or top 5 newest)
  const isCenterRecentlyCreated = (center, index) => {
    if (index < 3) return true; // Top 3 newest centers always marked new
    if (center.created_at) {
      const cDate = new Date(center.created_at);
      return !isNaN(cDate) && cDate > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
    return false;
  };

  return (
    <>
      <div className="no-print min-h-screen bg-slate-950 p-4 md:p-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
          
          {/* Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:sticky md:top-8 shadow-2xl md:h-[calc(100vh-4rem)] flex flex-col">
              <div className="mb-8">
                <h1 className="text-xl font-black text-white leading-tight">Welcome,<br/>{staffName}</h1>
                <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mt-2">ID: {staffId}</p>
              </div>
              
              <div className="space-y-2">
                <button 
                  onClick={() => { setActiveView('recent'); setSearchQuery(''); setSelectedCenterId('ALL'); }}
                  className={`w-full text-left px-5 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-between gap-3 cursor-pointer ${activeView === 'recent' && !isSearchOrFilterActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  <span className="flex items-center gap-3">
                    <FaUsers size={16} /> Recent
                  </span>
                  <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                    {members.filter(m => m.status !== 'ARCHIVED').length}
                  </span>
                </button>
                <button 
                  onClick={() => { setActiveView('all'); setSelectedCenterId('ALL'); }}
                  className={`w-full text-left px-5 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-between gap-3 cursor-pointer ${activeView === 'all' && !isSearchOrFilterActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  <span className="flex items-center gap-3">
                    <FaUsers size={16} /> All Members
                  </span>
                  <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                    {members.length}
                  </span>
                </button>
              </div>

              <div className="mt-auto pt-6 border-t border-white/10 space-y-3">
                <button 
                  onClick={() => fetchCenters(true)} 
                  disabled={refreshing || loading}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/5 px-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                  title="Reload data from database"
                >
                  <FaSyncAlt size={13} className={refreshing || loading ? 'animate-spin text-blue-400' : ''} />
                  {refreshing ? 'Refreshing...' : 'Refresh Data'}
                </button>

                <button 
                  onClick={handleLogout} 
                  className="w-full flex items-center justify-center gap-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 cursor-pointer"
                >
                  <FaSignOutAlt size={16} /> Logout
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Header / Search & Center Filter */}
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center shadow-2xl">
              {/* Center Quick Filter Dropdown (Newest Centers Tagged) */}
              <div className="w-full md:w-72 relative">
                <FaBuilding className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select 
                  value={selectedCenterId}
                  onChange={(e) => {
                    setSelectedCenterId(e.target.value);
                    if (activeView === 'recent') setActiveView('all');
                  }}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-11 pr-8 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm font-bold appearance-none cursor-pointer"
                >
                  <option value="ALL">All Centers ({centers.length})</option>
                  {recentCenters.map((c, idx) => {
                    const isNew = isCenterRecentlyCreated(c, idx);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.center_no ? `(${c.center_no})` : ''} {isNew ? '✨ [NEW]' : ''}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                  ▼
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-96">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search center, member, ID, phone..." 
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value && activeView === 'recent') {
                      setActiveView('all');
                    }
                  }}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-12 pr-10 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm font-bold placeholder:text-slate-600"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Clear Search"
                  >
                    <FaTimes size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Active Search / Filter Status Banner */}
            {isSearchOrFilterActive && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-blue-950/40 border border-blue-500/30 rounded-2xl px-5 py-3 text-sm">
                <div className="flex items-center gap-2 text-blue-300 font-medium">
                  <span>Found</span>
                  <span className="font-black text-white bg-blue-500/20 px-2.5 py-0.5 rounded-lg border border-blue-500/40">
                    {totalFilteredMembers} {totalFilteredMembers === 1 ? 'member' : 'members'}
                  </span>
                  <span>in</span>
                  <span className="font-black text-white bg-blue-500/20 px-2.5 py-0.5 rounded-lg border border-blue-500/40">
                    {filteredCenterGroups.length} {filteredCenterGroups.length === 1 ? 'center' : 'centers'}
                  </span>
                  {searchQuery && (
                    <span className="text-slate-300">
                      for "<span className="text-blue-400 font-bold">{searchQuery}</span>"
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setSearchQuery(''); setSelectedCenterId('ALL'); }}
                  className="text-xs text-blue-400 hover:text-blue-200 font-bold uppercase tracking-wider underline cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            )}

            {/* Members List Grouped by Center */}
            {loading ? (
               <div className="text-center text-white py-16 font-bold uppercase tracking-widest animate-pulse flex flex-col items-center gap-4">
                 <FaSyncAlt className="animate-spin text-blue-500" size={28} />
                 <span>Loading centers & members...</span>
               </div>
            ) : centers.length > 0 ? (
              <div className="space-y-8">
                
                {/* Recently Added Section (only when on recent view and no active search/filter) */}
                {activeView === 'recent' && !isSearchOrFilterActive ? (
                  <div className="mb-8 space-y-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
                      <div>
                        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                          <span className="w-2.5 h-8 bg-green-500 rounded-full"></span>
                          Recently Added Centers & Members
                        </h2>
                        <p className="text-slate-400 text-xs mt-1">
                          Showing newest centers first with latest member loan slips
                        </p>
                      </div>

                      {/* Sub-filter tabs & Reset Button */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="bg-slate-950 p-1 rounded-xl border border-white/10 flex items-center gap-1">
                          <button
                            onClick={() => setRecentFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${recentFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                          >
                            All ({recentMembers.length})
                          </button>
                          <button
                            onClick={() => setRecentFilter('new')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${recentFilter === 'new' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}
                          >
                            New ({newCount})
                          </button>
                          <button
                            onClick={() => setRecentFilter('printed')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${recentFilter === 'printed' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                          >
                            Printed ({printedCount})
                          </button>
                        </div>

                        <button
                          onClick={handleResetPrintHistory}
                          className="text-[10px] text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 px-2.5 py-2 rounded-xl border border-white/5 font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Reset slip printed markers"
                        >
                          <FaHistory size={10} /> Reset Viewed
                        </button>
                      </div>
                    </div>
                    
                    {/* Render Centers in Recent order (Newest centers first) */}
                    {recentCenters.map((center, idx) => {
                      const centerRecent = recentMembers.filter(m => m.center_id === center.id);
                      const isNewCenter = isCenterRecentlyCreated(center, idx);
                      
                      // If it has no recent members AND it's not a newly created center, skip it in Recent view
                      if (centerRecent.length === 0 && !isNewCenter) return null;

                      return (
                        <div 
                          key={`recent-${center.id}`} 
                          className={`bg-slate-900 border rounded-3xl overflow-hidden shadow-2xl transition-all ${
                            isNewCenter ? 'border-green-500/40 shadow-green-950/20' : 'border-white/10'
                          }`}
                        >
                          <div className={`p-4 border-b flex flex-wrap justify-between items-center gap-2 ${
                            isNewCenter ? 'bg-green-950/20 border-green-500/20' : 'bg-slate-800/50 border-white/10'
                          }`}>
                            <div className="flex items-center gap-3">
                              <span className={`w-2.5 h-6 rounded-full ${isNewCenter ? 'bg-green-400' : 'bg-blue-500'}`}></span>
                              <div>
                                <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                                  {center.name} Center
                                  {center.center_no && (
                                    <span className="text-xs text-slate-400 font-mono font-bold">({center.center_no})</span>
                                  )}
                                  {isNewCenter && (
                                    <span className="bg-green-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest shadow-md shadow-green-500/30 flex items-center gap-1">
                                      ✨ NEW CENTER
                                    </span>
                                  )}
                                </h3>
                                {center.created_at && (
                                  <p className="text-[10px] text-slate-400 font-medium">
                                    Added on {new Date(center.created_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>

                            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
                              centerRecent.length > 0 
                                ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                : 'bg-slate-800 text-slate-400 border-white/5'
                            }`}>
                              {centerRecent.length} {centerRecent.length === 1 ? 'Member' : 'Members'}
                            </span>
                          </div>

                          {centerRecent.length > 0 ? (
                            <div className="divide-y divide-white/5">
                              {centerRecent.map(member => renderMemberRow(member))}
                            </div>
                          ) : (
                            <div className="p-6 text-center text-slate-500 text-xs font-medium italic bg-slate-950/40">
                              ✨ New center created — Waiting for loan applications to be disbursed.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {/* All Members / Filtered Centers List */}
                {(activeView === 'all' || isSearchOrFilterActive) && (
                  filteredCenterGroups.length > 0 ? (
                    filteredCenterGroups.map(({ center, members: centerMembers, isCenterMatch }) => (
                      <div key={center.id} className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-white/10 bg-slate-800/50 flex justify-between items-center">
                          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                            <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
                            {center.name} Center
                            {center.center_no && (
                              <span className="text-xs text-slate-400 font-mono font-bold">({center.center_no})</span>
                            )}
                            {isCenterMatch && (
                              <span className="ml-2 bg-blue-500/20 text-blue-300 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider border border-blue-500/30">
                                Center Match
                              </span>
                            )}
                          </h2>
                          <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-blue-500/20">
                            {centerMembers.length} {centerMembers.length === 1 ? 'Member' : 'Members'}
                          </span>
                        </div>
                        {centerMembers.length > 0 ? (
                          <div className="divide-y divide-white/10">
                            {centerMembers.map(member => renderMemberRow(member))}
                          </div>
                        ) : (
                          <div className="p-8 text-center text-slate-500 font-medium italic">
                            No members found in this center.
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="bg-slate-900 border border-white/10 rounded-3xl p-12 text-center shadow-2xl">
                      <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-500 border border-white/5">
                        <FaSearch size={24} />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">No Matching Results</h3>
                      <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
                        {isSearchOrFilterActive ? (
                          <>No centers or members matched your search <span className="text-blue-400 font-bold">{searchQuery ? `"${searchQuery}"` : ''}</span>. Try searching by center name, center number, member name, or mobile number.</>
                        ) : (
                          <>No members found in any of your centers.</>
                        )}
                      </p>
                      {isSearchOrFilterActive && (
                        <button 
                          onClick={() => { setSearchQuery(''); setSelectedCenterId('ALL'); }}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
                        >
                          Clear Search & Filters
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>
            ) : null}
          </div> {/* End Main Content */}
        </div>
      </div>

      {/* Preview Modal - Visible on Screen */}
      {showPreview && memberToPrint && (
        <div className="no-print fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-6 px-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-[900px] flex flex-col my-auto">
            
            {/* Sticky Header */}
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-slate-800/50 rounded-t-3xl sticky top-0 z-10">
              <h2 className="text-lg font-black text-white uppercase tracking-widest">Document Preview</h2>
              <div className="flex gap-3">
                <button 
                  onClick={closePreview}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={executePrint}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <FaPrint size={13} /> Print Now
                </button>
              </div>
            </div>

            {/* Scrollable slip area */}
            <div className="overflow-x-auto overflow-y-visible bg-slate-950 p-6 flex justify-center rounded-b-3xl">
              <div className="origin-top" style={{ zoom: 0.82 }}>
                <PrintableMemberSlip member={memberToPrint} centerName={centerName} isPreview={true} schedules={memberSchedules} />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Actual Printable Area - Hidden on screen, visible on print */}
      {memberToPrint && <PrintableMemberSlip member={memberToPrint} centerName={centerName} schedules={memberSchedules} />}
    </>
  );
}
