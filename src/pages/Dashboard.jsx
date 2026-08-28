import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPrint, FaSignOutAlt, FaUsers, FaSearch, FaTimes, FaBuilding } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import PrintableMemberSlip from '../components/PrintableMemberSlip';

export default function Dashboard() {
  const [centers, setCenters] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [memberToPrint, setMemberToPrint] = useState(null);
  const [memberSchedules, setMemberSchedules] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCenterId, setSelectedCenterId] = useState('ALL');
  const [activeView, setActiveView] = useState('recent');
  
  const staffId = sessionStorage.getItem('staffId');
  const staffName = sessionStorage.getItem('staffName');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCenters();
  }, []);

  const fetchCenters = async () => {
    try {
      const { data: staffCenters, error } = await supabase
        .from('centers')
        .select('*')
        .ilike('staff_id', staffId)
        .order('name', { ascending: true });
        
      if (error) throw error;
      const fetchedCenters = staffCenters || [];
      setCenters(fetchedCenters);
      
      // Automatically fetch all members for all centers
      if (fetchedCenters.length > 0) {
        fetchAllMembers(fetchedCenters);
      }
    } catch (err) {
      console.error('Error fetching centers:', err);
    }
  };

  const fetchAllMembers = async (centerList) => {
    if (!centerList || centerList.length === 0) return;
    setLoading(true);
    try {
      const centerIds = centerList.map(c => c.id);
      const { data: membersData, error: memError } = await supabase
        .from('loans')
        .select('member_name, id, member_id, amount_sanctioned, credited_at, created_at, member_photo_url, mobile_no, nominee_mobile, center_id, status, members(member_no)')
        .in('center_id', centerIds)
        .in('status', ['DISBURSED', 'ARCHIVED'])
        .order('member_name', { ascending: true });

      if (memError) throw memError;

      const formattedMembers = (membersData || []).map(m => ({
        ...m,
        member_no: m.members?.member_no || null,
        loan_app_id: m.loan_app_id || null,
        amount_sanctioned: Number(m.amount_sanctioned) || 0
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
      alert('Failed to hide member.');
    }
  };

  const handlePreview = async (member) => {
    setPreviewLoading(true);
    try {
      // Fetch schedules based on the loan ID
      const { data, error } = await supabase
        .from('collection_schedules')
        .select('scheduled_date, amount, week_number, scheduled_day')
        .or(`loan_id.eq.${member.id},and(loan_id.is.null,member_id.eq.${member.id})`)
        .order('week_number', { ascending: true });
        
      if (error) throw error;
      const fetchedSchedules = data || [];
      
      setMemberSchedules(fetchedSchedules);
      setMemberToPrint(member);
      setShowPreview(true);

      // Mark as viewed so it disappears from "Recently Added"
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

  const centerName = centers.find(c => c.id === memberToPrint?.center_id)?.name || '';

  const renderMemberRow = (member) => {
    const printedIds = JSON.parse(localStorage.getItem('printed_loans') || '[]');
    const isPrinted = member._printed || printedIds.includes(member.id);
    const memberDate = member.created_at || member.credited_at;
    const isNew = !isPrinted && memberDate && new Date(memberDate) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return (
      <div key={member.id} className={`p-6 flex flex-col md:flex-row items-start md:items-center justify-between hover:bg-white/5 transition-colors gap-4 ${isNew ? 'bg-green-500/5' : ''}`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
             {member.member_photo_url ? (
               <img src={member.member_photo_url} alt="" className="w-full h-full object-cover" />
             ) : <FaUsers className="text-slate-500" size={24} />}
          </div>
          <div className="flex-1">
            <h3 className="font-black text-white text-lg uppercase tracking-tight flex items-center gap-2">
              {member.member_name}
              {isNew && (
                <span className="bg-green-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest shadow-lg shadow-green-500/20">
                  NEW
                </span>
              )}
              {member.status === 'ARCHIVED' && (
                <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest shadow-lg shadow-red-500/20">
                  DELETED
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
            </div>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => handlePreview(member)}
            disabled={previewLoading}
            className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
          >
            <FaPrint size={14} /> Preview
          </button>
          {member.status !== 'ARCHIVED' ? (
            <button 
              onClick={() => handleDeleteMember(member.id)}
              className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95"
              title="Delete Member"
            >
              Delete
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
        // Center itself matches if all query tokens are found in center metadata
        const isCenterMatch = qTokens.length > 0 && qTokens.every(token => centerSearchText.includes(token));

        const centerMembers = members.filter(m => m.center_id === center.id);

        const filteredMembers = isCenterMatch
          ? centerMembers // If center itself matched, show all members in this center
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
        // If there's an active search or specific center filter selected:
        if (qTokens.length > 0 || selectedCenterId !== 'ALL') {
          return group.members.length > 0 || group.isCenterMatch;
        }
        // If viewing all with no search: show centers that have members
        return group.members.length > 0;
      });
  };

  const getRecentMembers = () => {
    const printedIds = JSON.parse(localStorage.getItem('printed_loans') || '[]');
    return members.filter(member => {
      const isPrinted = member._printed || printedIds.includes(member.id);
      const memberDate = member.created_at || member.credited_at;
      return !isPrinted && memberDate && new Date(memberDate) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }).sort((a, b) => {
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
  };

  const recentMembers = getRecentMembers();
  const filteredCenterGroups = getFilteredCenterGroups();
  const totalFilteredMembers = filteredCenterGroups.reduce((acc, g) => acc + g.members.length, 0);
  const isSearchOrFilterActive = Boolean(searchQuery.trim() || selectedCenterId !== 'ALL');

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
                  className={`w-full text-left px-5 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center gap-3 ${activeView === 'recent' && !isSearchOrFilterActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  <FaUsers size={16} /> Recent
                </button>
                <button 
                  onClick={() => { setActiveView('all'); setSelectedCenterId('ALL'); }}
                  className={`w-full text-left px-5 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center gap-3 ${activeView === 'all' && !isSearchOrFilterActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  <FaUsers size={16} /> All Members
                </button>
              </div>

              <div className="mt-auto pt-8 border-t border-white/10">
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95">
                  <FaSignOutAlt size={16} /> Logout
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Header / Search & Center Filter */}
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center shadow-2xl">
              {/* Center Quick Filter Dropdown */}
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
                  {centers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} Center {c.center_no ? `(${c.center_no})` : ''}
                    </option>
                  ))}
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
                  placeholder="Search center, member name, ID, phone..." 
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
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
               <div className="text-center text-white py-10 font-bold uppercase tracking-widest animate-pulse">Loading members...</div>
            ) : centers.length > 0 ? (
              <div className="space-y-8">
                
                {/* Recently Added Section (only when on recent view and no active search/filter) */}
                {activeView === 'recent' && !isSearchOrFilterActive ? (
                  recentMembers.length > 0 ? (
                    <div className="mb-8 space-y-4">
                      <div className="bg-green-900/20 border border-green-500/30 rounded-2xl p-4 flex justify-between items-center shadow-lg shadow-green-900/10">
                        <h2 className="text-xl font-bold text-green-400 tracking-tight flex items-center gap-2">
                          <span className="w-2 h-8 bg-green-400 rounded-full"></span>
                          Recently Added
                        </h2>
                        <span className="bg-green-500/20 text-green-300 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-green-500/30">
                          {recentMembers.length} Total New
                        </span>
                      </div>
                      
                      {centers.map(center => {
                        const centerRecent = recentMembers.filter(m => m.center_id === center.id);
                        if (centerRecent.length === 0) return null;
                        return (
                          <div key={`recent-${center.id}`} className="bg-green-900/10 border border-green-500/20 rounded-3xl overflow-hidden shadow-xl shadow-green-900/5">
                            <div className="p-4 border-b border-green-500/10 bg-green-800/20 flex justify-between items-center">
                              <h3 className="text-md font-bold text-green-300 tracking-tight flex items-center gap-2">
                                {center.name} Center
                              </h3>
                              <span className="bg-green-500/10 text-green-400 text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest border border-green-500/20">
                                {centerRecent.length} Members
                              </span>
                            </div>
                            <div className="divide-y divide-green-500/10">
                              {centerRecent.map(member => renderMemberRow(member))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-12 text-center text-slate-500 font-bold italic bg-slate-900 rounded-3xl border border-white/10">
                      No recently added members found.
                    </div>
                  )
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
                            No active or disbursed members found in this center.
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
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-[900px] flex flex-col">
            
            {/* Sticky Header */}
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-slate-800/50 rounded-t-3xl sticky top-0 z-10">
              <h2 className="text-lg font-black text-white uppercase tracking-widest">Document Preview</h2>
              <div className="flex gap-3">
                <button 
                  onClick={closePreview}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                >
                  Cancel
                </button>
                <button 
                  onClick={executePrint}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  <FaPrint size={13} /> Print Now
                </button>
              </div>
            </div>

            {/* Scrollable slip area — renders at natural A4 width, overflow scrolls */}
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
