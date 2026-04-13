import { useState, useEffect, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';

// Icons embedded as SVG components
const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const LogInIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
  </svg>
);

const LogOutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SheetIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);


const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const FilterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

// Types
type Status = 'OUT' | 'IN';
type LogType = 'TIME_IN' | 'TIME_OUT' | 'ABSENT' | 'HOLIDAY';

interface Log {
  id: string;
  user_id?: string;
  type: LogType;
  timestamp: string; // ISO string 
}

interface User {
  id: string;
  username: string;
  name: string;
}

const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatHM = (totalHoursFraction: number) => {
  let h = Math.floor(totalHoursFraction);
  let m = Math.round((totalHoursFraction - h) * 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  return { h, m, formatted: `${h}h ${m}m` };
};

const CustomDatePicker = ({ value, onChange, label }: { value: string, onChange: (val: string) => void, label: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? parseLocalDate(value) : new Date());
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const handleDateSelect = (day: number) => {
    const y = viewDate.getFullYear();
    const m = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };

  const changeMonth = (offset: number) => {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
    setViewDate(next);
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div ref={pickerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="date-input"
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '44px' }}
      >
        <span>{value ? parseLocalDate(value).toLocaleDateString() : label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
      </div>

      {isOpen && (
        <>
          {windowWidth < 768 && <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.2)', zIndex: 9998, backdropFilter: 'blur(2px)' }} onClick={() => setIsOpen(false)} />}
          <div
            className="glass-panel"
            style={{
              position: windowWidth < 768 ? 'fixed' : 'absolute',
              top: windowWidth < 768 ? '50%' : '105%',
              left: '50%',
              transform: windowWidth < 768 ? 'translate(-50%, -50%)' : 'translateX(-50%)',
              zIndex: 9999,
              padding: '1.25rem',
              width: '300px',
              maxWidth: 'calc(100vw - 2rem)',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(30, 41, 59, 0.75)',
              backdropFilter: 'blur(12px)',
              pointerEvents: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => changeMonth(-1)} className="btn-export" style={{ padding: '4px' }}>←</button>
                <button type="button" onClick={() => changeMonth(1)} className="btn-export" style={{ padding: '4px' }}>→</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
              {Array.from({ length: firstDayOfMonth(viewDate.getMonth(), viewDate.getFullYear()) }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth(viewDate.getMonth(), viewDate.getFullYear()) }).map((_, i) => {
                const day = i + 1;
                const isToday = new Date().toDateString() === new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toDateString();
                const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = value === dateStr;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    style={{
                      padding: '8px 0',
                      border: 'none',
                      borderRadius: '4px',
                      background: isSelected ? 'var(--primary)' : isToday ? 'rgba(79, 70, 229, 0.2)' : 'transparent',
                      color: isSelected ? 'white' : 'var(--text-main)',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '1rem', paddingTop: '0.5rem' }}>
              <button type="button" onClick={() => { onChange(''); setIsOpen(false); }} className="btn-export" style={{ border: 'none', color: 'var(--danger)', fontSize: '0.8rem' }}>Clear</button>
              <button type="button" onClick={() => {
                const now = new Date();
                const yy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                onChange(`${yy}-${mm}-${dd}`);
                setViewDate(now);
                setIsOpen(false);
              }} className="btn-export" style={{ border: 'none', color: 'var(--primary)', fontSize: '0.8rem' }}>Today</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

function App() {
  // Authentication & Users State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [usernameInput, setUsernameInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [loadingMode, setLoadingMode] = useState(false);

  // App State
  const [currentTime, setCurrentTime] = useState(new Date());
  const [status, setStatus] = useState<Status>('OUT');
  const [logs, setLogs] = useState<Log[]>([]);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [filterAbsent, setFilterAbsent] = useState(false);
  const [filterHoliday, setFilterHoliday] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Manual Entry State
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualType, setManualType] = useState<'SHIFT' | 'ABSENT' | 'HOLIDAY'>('SHIFT');
  const [manualDate, setManualDate] = useState('');
  const [manualTimeIn, setManualTimeIn] = useState('');
  const [manualTimeOut, setManualTimeOut] = useState('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
    };
    if (showFilterMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterMenu]);

  // Session persistence across reloads via localStorage auth token mapping
  useEffect(() => {
    const savedSessionId = localStorage.getItem('dtr_session_id');
    if (savedSessionId) {
      supabase.from('custom_users').select('*').eq('id', savedSessionId).single().then(({ data }) => {
        if (data) setCurrentUser(data);
      });
    }
  }, []);

  // When user logs in, load their specific logs from Supabase
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('dtr_session_id', currentUser.id);
      const fetchLogs = async () => {
        const { data, error } = await supabase
          .from('logs')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('timestamp', { ascending: false });

        if (error) {
          console.error('Error fetching logs:', error.message);
        } else if (data) {
          setLogs(data);
          if (data.length > 0) {
            setStatus(data[0].type === 'TIME_IN' ? 'IN' : 'OUT');
          } else {
            setStatus('OUT');
          }
        }
      };
      fetchLogs();
    } else {
      localStorage.removeItem('dtr_session_id');
      setLogs([]);
      setStatus('OUT');
    }
  }, [currentUser]);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date | string, includeSeconds = true) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
      hour12: true
    });
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    setLoadingMode(true);

    if (authMode === 'REGISTER') {
      if (!nameInput.trim()) {
        alert('Please enter your full name.');
        setLoadingMode(false);
        return;
      }

      const { data: existing } = await supabase.from('custom_users').select('id').ilike('username', usernameInput.trim());

      if (existing && existing.length > 0) {
        alert('Username already exists! Please login instead.');
      } else {
        const { data, error } = await supabase.from('custom_users')
          .insert([{ username: usernameInput.trim(), name: nameInput.trim() }])
          .select();

        if (error) alert('Database Error: ' + error.message);
        else if (data) setCurrentUser(data[0]);
      }
    } else {
      const { data, error } = await supabase.from('custom_users')
        .select('*')
        .ilike('username', usernameInput.trim());

      if (error) alert('Database Error: ' + error.message);
      else if (data && data.length > 0) {
        setCurrentUser(data[0]);
      } else {
        alert('User not found. Please register.');
      }
    }

    setLoadingMode(false);
    setUsernameInput('');
    setNameInput('');
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // Determine today's limits
  const todayStr = new Date().toLocaleDateString();
  const hasTimedInToday = logs.some(log => log.type === 'TIME_IN' && new Date(log.timestamp).toLocaleDateString() === todayStr);
  const hasTimedOutToday = logs.some(log => log.type === 'TIME_OUT' && new Date(log.timestamp).toLocaleDateString() === todayStr);

  const performCloudInsert = async (newLog: Log, optimisticId: string) => {
    const dbLog = { user_id: currentUser!.id, type: newLog.type, timestamp: newLog.timestamp };
    setLogs(prev => [newLog, ...prev]); // Optimistic Update

    const { data, error } = await supabase.from('logs').insert([dbLog]).select();

    if (error) {
      alert('Failed to sync to cloud: ' + error.message);
      // Revert optimistic update
      setLogs(prev => prev.filter(l => l.id !== newLog.id));
    } else if (data) {
      // Overwrite with confirmed DB ID
      setLogs(prev => prev.map(l => l.id === optimisticId ? { ...l, id: data[0].id } : l));
    }
  };

  const handleTimeIn = async () => {
    if (hasTimedInToday) { alert("You have already timed in today!"); return; }
    setStatus('IN');
    const optimisticId = crypto.randomUUID();
    await performCloudInsert({ id: optimisticId, type: 'TIME_IN', timestamp: new Date().toISOString() }, optimisticId);
  };

  const handleTimeOut = async () => {
    if (hasTimedOutToday) { alert("You have already timed out today!"); return; }
    setStatus('OUT');
    const optimisticId = crypto.randomUUID();
    await performCloudInsert({ id: optimisticId, type: 'TIME_OUT', timestamp: new Date().toISOString() }, optimisticId);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDate) {
      alert('Please select a date.');
      return;
    }

    if (manualType === 'SHIFT' && !manualTimeIn && !manualTimeOut) {
      alert('Please fill out at least one time field (Time In or Time Out).');
      return;
    }

    const targetDate = new Date(`${manualDate}T12:00:00`);
    const targetDateStr = targetDate.toLocaleDateString();

    const existingIn = logs.some(log => new Date(log.timestamp).toLocaleDateString() === targetDateStr && log.type === 'TIME_IN');
    const existingOut = logs.some(log => new Date(log.timestamp).toLocaleDateString() === targetDateStr && log.type === 'TIME_OUT');
    const existingSpecial = logs.some(log => new Date(log.timestamp).toLocaleDateString() === targetDateStr && (log.type === 'ABSENT' || log.type === 'HOLIDAY'));

    if (manualType !== 'SHIFT' && (existingIn || existingOut || existingSpecial)) {
      alert('A record already exists for this exact date.');
      return;
    }

    if (manualType === 'SHIFT') {
      if (manualTimeIn && existingIn) {
        alert('A Time In record already exists for this date.');
        return;
      }
      if (manualTimeOut && existingOut) {
        alert('A Time Out record already exists for this date.');
        return;
      }
    }

    let timeInDate = null;
    let timeOutDate = null;

    if (manualType === 'SHIFT' && manualTimeIn) timeInDate = new Date(`${manualDate}T${manualTimeIn}`);
    if (manualType === 'SHIFT' && manualTimeOut) timeOutDate = new Date(`${manualDate}T${manualTimeOut}`);

    if (timeInDate && timeOutDate && timeOutDate <= timeInDate) {
      alert('Your Time Out must be after your Time In.');
      return;
    }

    setLoadingMode(true);

    const insertsData = [];
    if (manualType === 'SHIFT') {
      if (timeInDate) insertsData.push({ user_id: currentUser!.id, type: 'TIME_IN', timestamp: timeInDate.toISOString() });
      if (timeOutDate) insertsData.push({ user_id: currentUser!.id, type: 'TIME_OUT', timestamp: timeOutDate.toISOString() });
    } else {
      insertsData.push({ user_id: currentUser!.id, type: manualType, timestamp: targetDate.toISOString() });
    }

    const { data, error } = await supabase.from('logs').insert(insertsData).select();

    if (error) {
      alert('Failed to save manual log to cloud: ' + error.message);
    } else if (data) {
      // Re-fetch all logs cleanly to ensure sorting
      const { data: freshData } = await supabase.from('logs').select('*').eq('user_id', currentUser!.id).order('timestamp', { ascending: false });
      if (freshData) setLogs(freshData);

      setShowManualEntry(false);
      setManualDate('');
      setManualTimeIn('');
      setManualTimeOut('');
    }
    setLoadingMode(false);
  };

  const handleDeleteDay = async (logIds: string[]) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    setLoadingMode(true);
    const { error } = await supabase.from('logs').delete().in('id', logIds);
    if (error) {
      alert('Delete failed: ' + error.message);
    } else {
      setLogs(prev => prev.filter(log => !logIds.includes(log.id)));
    }
    setLoadingMode(false);
  };

  // Memoized pairing logic for UI & Exports
  const filteredAndPairedLogs = useMemo(() => {
    let filteredLogs = [...logs];
    if (exportStartDate) {
      const start = parseLocalDate(exportStartDate);
      start.setHours(0, 0, 0, 0);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= start);
    }
    if (exportEndDate) {
      const end = parseLocalDate(exportEndDate);
      end.setHours(23, 59, 59, 999);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= end);
    }

    const sortedLogs = [...filteredLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const pairedData = [];
    let currentPair: { ids: string[], date: string, timeIn: string, timeOut: string, rawIn: Date | null, rawOut: Date | null } | null = null;

    const buildOutput = (pair: any) => {
      let totalHours = '-';
      let hoursNum = 0;
      if (pair.rawIn && pair.rawOut) {
        let breakTimeMs = 0;
        const lunchStart = new Date(pair.rawIn);
        lunchStart.setHours(12, 0, 0, 0);
        const lunchEnd = new Date(pair.rawIn);
        lunchEnd.setHours(13, 0, 0, 0);

        const overlapStart = Math.max(pair.rawIn.getTime(), lunchStart.getTime());
        const overlapEnd = Math.min(pair.rawOut.getTime(), lunchEnd.getTime());

        if (overlapEnd > overlapStart) {
          breakTimeMs = overlapEnd - overlapStart;
        }

        const nineAM = new Date(pair.rawIn);
        nineAM.setHours(9, 0, 0, 0);

        const effectiveIn = Math.max(pair.rawIn.getTime(), nineAM.getTime());
        const workMs = Math.max(0, pair.rawOut.getTime() - effectiveIn - breakTimeMs);
        let finalHoursNum = workMs / (1000 * 60 * 60);

        // Special rule: If it's Saturday and they rendered >= 3 hours, max it out precisely to 8 hours
        if (pair.rawIn.getDay() === 6 && finalHoursNum >= 3) {
          finalHoursNum = 8;
        }

        const formatted = formatHM(finalHoursNum);
        hoursNum = finalHoursNum;
        totalHours = formatted.formatted;
      }
      return {
        id: crypto.randomUUID(),
        logIds: pair.ids,
        date: pair.date,
        timeIn: pair.timeIn,
        lunchOut: '12:00 PM',
        lunchIn: '01:00 PM',
        timeOut: pair.timeOut,
        totalHours,
        hoursNum
      };
    };

    for (const log of sortedLogs) {
      const dateStr = formatDate(log.timestamp);
      const timeStr = formatTime(log.timestamp, false);
      const logDate = new Date(log.timestamp);

      if (log.type === 'TIME_IN') {
        if (currentPair) {
          pairedData.push(buildOutput(currentPair));
        }
        currentPair = { ids: [log.id], date: dateStr, timeIn: timeStr, timeOut: '-', rawIn: logDate, rawOut: null };
      } else if (log.type === 'TIME_OUT') {
        if (currentPair && currentPair.date === dateStr) {
          currentPair.timeOut = timeStr;
          currentPair.rawOut = logDate;
          currentPair.ids.push(log.id);
          pairedData.push(buildOutput(currentPair));
          currentPair = null;
        } else {
          if (currentPair) pairedData.push(buildOutput(currentPair));
          pairedData.push(buildOutput({ ids: [log.id], date: dateStr, timeIn: '-', timeOut: timeStr, rawIn: null, rawOut: logDate }));
          currentPair = null;
        }
      } else if (log.type === 'ABSENT' || log.type === 'HOLIDAY') {
        if (currentPair) pairedData.push(buildOutput(currentPair));
        pairedData.push({
          id: crypto.randomUUID(),
          logIds: [log.id],
          date: dateStr,
          timeIn: log.type,
          lunchOut: '-',
          lunchIn: '-',
          timeOut: '-',
          totalHours: '-',
          hoursNum: 0
        });
        currentPair = null;
      }
    }
    if (currentPair) {
      pairedData.push(buildOutput(currentPair));
    }

    // Auto-fill missing days with 'Absent / Holiday'
    const finalData: any[] = [];
    const minRawDate = sortedLogs.length > 0 ? new Date(sortedLogs[0].timestamp) : null;
    const start = exportStartDate ? parseLocalDate(exportStartDate) : minRawDate;

    // Always stop at today natively unless exportEndDate is earlier
    const end = exportEndDate ? parseLocalDate(exportEndDate) : new Date();

    if (start && end) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      let cursor = new Date(start);
      const now = new Date();

      while (cursor <= end && cursor <= now) {
        const dStr = formatDate(cursor);
        const dayMatches = pairedData.filter(p => p.date === dStr);

        if (dayMatches.length > 0) {
          finalData.push(...dayMatches);
        } else {
          // If the day is empty, logically mark as absent. (Mark Sundays formally as REST DAY)
          const isSunday = cursor.getDay() === 0;
          finalData.push({
            id: crypto.randomUUID(),
            date: dStr,
            timeIn: isSunday ? 'REST DAY' : 'ABSENT',
            lunchOut: '-',
            lunchIn: '-',
            timeOut: '-',
            totalHours: '-',
            hoursNum: 0
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    let filteredResult = finalData;
    if (filterAbsent || filterHoliday) {
      filteredResult = filteredResult.filter(r => {
        const isAbsent = r.timeIn === 'ABSENT';
        const isHoliday = r.timeIn === 'HOLIDAY';
        return (filterAbsent && isAbsent) || (filterHoliday && isHoliday);
      });
    }

    return filteredResult;
  }, [logs, exportStartDate, exportEndDate, filterAbsent, filterHoliday]);

  const stats = useMemo(() => {
    const totalRaw = filteredAndPairedLogs.reduce((acc, curr) => acc + (curr.hoursNum || 0), 0);
    const goal = 540;
    const remainingRaw = Math.max(0, goal - totalRaw);

    const totalStats = formatHM(totalRaw);
    const remainingStats = formatHM(remainingRaw);

    return {
      total: totalStats.h,
      formattedTotal: totalStats.formatted,
      formattedRemaining: remainingStats.formatted,
      goal
    };
  }, [filteredAndPairedLogs]);



  const exportCSV = () => {
    if (!currentUser) return;
    if (filteredAndPairedLogs.length === 0) {
      alert('No records found in the selected date range.');
      return;
    }

    const headers = ['Date', 'Time In', 'L-Out', 'L-In', 'Time Out', 'Hours'];
    const rows = filteredAndPairedLogs.map(row => [row.date, row.timeIn, row.lunchOut, row.lunchIn, row.timeOut, row.totalHours]);

    const escapeCSV = (field: string) => `"${field.replace(/"/g, '""')}"`;

    const displayName = currentUser.name || currentUser.username;
    const firstDataDate = filteredAndPairedLogs[0].date;
    const lastDataDate = filteredAndPairedLogs[filteredAndPairedLogs.length - 1].date;
    const displayStart = (exportStartDate ? parseLocalDate(exportStartDate).toLocaleDateString() : firstDataDate).replace(/\//g, '-');
    const displayEnd = (exportEndDate ? parseLocalDate(exportEndDate).toLocaleDateString() : lastDataDate).replace(/\//g, '-');
    const fileName = `DTR_${displayName}_${displayStart}_to_${displayEnd}.csv`;

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Add BOM for proper UTF-8 handling in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    if (!currentUser) return;
    if (filteredAndPairedLogs.length === 0) {
      alert('No records found in the selected date range.');
      return;
    }

    const doc = new jsPDF();

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Daily Time Record", 14, 22);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const displayName = currentUser.name || currentUser.username;
    doc.text(`Employee: ${displayName}`, 14, 32);

    const firstDataDate = filteredAndPairedLogs[0].date;
    const lastDataDate = filteredAndPairedLogs[filteredAndPairedLogs.length - 1].date;
    const displayStartRaw = exportStartDate ? parseLocalDate(exportStartDate).toLocaleDateString() : firstDataDate;
    const displayEndRaw = exportEndDate ? parseLocalDate(exportEndDate).toLocaleDateString() : lastDataDate;

    const displayStart = displayStartRaw.replace(/\//g, '-');
    const displayEnd = displayEndRaw.replace(/\//g, '-');

    doc.text(`Period: ${displayStartRaw} to ${displayEndRaw}`, 14, 39);

    const tableData = filteredAndPairedLogs.map(row => [row.date, row.timeIn, row.lunchOut, row.lunchIn, row.timeOut, row.totalHours]);

    // Render table
    autoTable(doc, {
      startY: 45,
      head: [['Date', 'Time In', 'L-Out', 'L-In', 'Time Out', 'Hours']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }, // Indigo
      alternateRowStyles: { fillColor: [248, 250, 252] },
      willDrawCell: (data) => {
        if (data.section === 'body') {
          const rowVal = data.row.cells[1].text[0]; // Check Time In column
          if (rowVal === 'ABSENT') {
            doc.setFillColor(254, 226, 226); // Soft Red
            doc.setTextColor(220, 38, 38);   // Dark Red
          } else if (rowVal === 'HOLIDAY') {
            doc.setFillColor(254, 243, 199); // Soft Amber
            doc.setTextColor(217, 119, 6);   // Dark Amber
          } else if (rowVal === 'REST DAY') {
            doc.setFillColor(237, 233, 254); // Soft Purple
            doc.setTextColor(109, 40, 217);  // Dark Purple
          }
        }
      }
    });

    doc.save(`DTR_${displayName}_${displayStart}_to_${displayEnd}.pdf`);
  };

  if (!currentUser) {
    return (
      <div className="dtr-container" style={{ gridTemplateColumns: '1fr' }}>
        <div className="glass-panel auth-container">
          <div className="auth-tabs">
            <button
              className={`tab-btn ${authMode === 'LOGIN' ? 'active' : ''}`}
              onClick={() => { setAuthMode('LOGIN'); setUsernameInput(''); setNameInput(''); }}
            >
              Login
            </button>
            <button
              className={`tab-btn ${authMode === 'REGISTER' ? 'active' : ''}`}
              onClick={() => { setAuthMode('REGISTER'); setUsernameInput(''); setNameInput(''); }}
            >
              Register
            </button>
          </div>

          <header className="header" style={{ marginBottom: '2rem' }}>
            <h1><ClockIcon /> DTR Portal</h1>
            <p>Please {authMode.toLowerCase()} to continue</p>
          </header>

          <form onSubmit={handleAuth}>
            {authMode === 'REGISTER' && (
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Enter your username"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loadingMode} style={{ opacity: loadingMode ? 0.7 : 1 }}>
              <LogInIcon />
              {loadingMode ? 'Connecting...' : (authMode === 'LOGIN' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="dtr-container">
      {/* Left Column: Action Panel */}
      <div className="glass-panel">
        <div className="top-nav">
          <div className="user-info">
            <div className="user-avatar">
              {(currentUser.name || currentUser.username).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="user-name-display">{currentUser.name || currentUser.username}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{currentUser.username}</div>
            </div>
          </div>
          <button className="btn btn-small btn-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <header className="header" style={{ marginBottom: '1.5rem' }}>
          <h1><ClockIcon /> DTR Portal</h1>
        </header>

        <div className="clock-display" style={{ margin: '1rem 0 2.5rem' }}>
          <div className="clock-time">{formatTime(currentTime)}</div>
          <div className="clock-date">{formatDate(currentTime)}</div>
        </div>

        {showManualEntry ? (
          <form className="actions" onSubmit={handleManualSubmit} style={{ gap: '0.75rem', padding: '1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Manual Entry</div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input type="radio" name="logType" checked={manualType === 'SHIFT'} onChange={() => setManualType('SHIFT')} /> Shift Log
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input type="radio" name="logType" checked={manualType === 'ABSENT'} onChange={() => setManualType('ABSENT')} /> Absent
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input type="radio" name="logType" checked={manualType === 'HOLIDAY'} onChange={() => setManualType('HOLIDAY')} /> Holiday
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date <span style={{ color: 'var(--danger)' }}>*</span></label>
              <CustomDatePicker
                value={manualDate}
                onChange={setManualDate}
                label="Select Date"
              />
            </div>

            {manualType === 'SHIFT' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Time In</label>
                    <input type="time" className="date-input" value={manualTimeIn} onChange={e => setManualTimeIn(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Time Out</label>
                    <input type="time" className="date-input" value={manualTimeOut} onChange={e => setManualTimeOut(e.target.value)} />
                  </div>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '-0.25rem' }}>
                  Fill out only the time you wish to arbitrarily add.
                </div>
              </>
            )}

            <div style={{ marginTop: '0.5rem', padding: '10px', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '8px', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '4px' }}>How to Use:</div>
              <ul style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: '14px', margin: 0 }}>
                <li>Select the <strong>Date</strong> you missed.</li>
                <li>Choose <strong>Shift Log</strong> to add Time In/Out.</li>
                <li>Use <strong>Absent/Holiday</strong> to mark an entire day as off.</li>
                <li>You can add only 1 missing field (like just Time Out) if needed.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-out" onClick={() => setShowManualEntry(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ margin: 0 }} disabled={loadingMode}>
                {loadingMode ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          </form>
        ) : (
          <div className="actions">
            <button
              className="btn btn-in"
              onClick={handleTimeIn}
              disabled={status === 'IN' || hasTimedInToday}
            >
              <LogInIcon />
              {hasTimedInToday ? "Timed In Today" : "Time In"}
            </button>

            <button
              className="btn btn-out"
              onClick={handleTimeOut}
              disabled={status === 'OUT' || hasTimedOutToday}
            >
              <LogOutIcon />
              {hasTimedOutToday ? "Timed Out Today" : "Time Out"}
            </button>

            <button
              className="btn btn-out"
              style={{ padding: '0.75rem', fontSize: '0.9rem', marginTop: '1rem', borderStyle: 'dashed' }}
              onClick={() => setShowManualEntry(true)}
            >
              <PlusIcon />
              Add Missing Record
            </button>
          </div>
        )}

        <div className="status-badge">
          <div className={`status-dot ${status === 'IN' ? 'active' : 'inactive'}`}></div>
          Status: {status === 'IN' ? 'Checked In' : 'Checked Out'}
        </div>
      </div>

      {/* Right Column: History Panel */}
      <div className="glass-panel history-section">
        <div className="history-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="history-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <span></span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Time</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{stats.formattedTotal} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {stats.goal}</span></div>
            </div>
            <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Remaining</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{stats.formattedRemaining}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }} ref={filterMenuRef}>
              <button
                className="btn-export"
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                style={{ margin: 0, backgroundColor: 'rgba(79, 70, 229, 0.15)', color: 'var(--primary)', borderColor: 'rgba(79, 70, 229, 0.25)' }}
              >
                <FilterIcon />
                Filter
              </button>

              {showFilterMenu && (
                <div className="glass-panel" style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  zIndex: 2000,
                  padding: '1rem',
                  width: '280px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(30, 41, 59, 0.75)',
                  backdropFilter: 'blur(12px)'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Search Single Date</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <CustomDatePicker
                      value={exportStartDate === exportEndDate ? exportStartDate : ''}
                      onChange={(val) => {
                        setExportStartDate(val);
                        setExportEndDate(val);
                        setShowFilterMenu(false);
                      }}
                      label="Find Date..."
                    />
                  </div>

                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.25rem 0' }} />

                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custom Range</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Start Date</label>
                      <CustomDatePicker
                        value={exportStartDate}
                        onChange={setExportStartDate}
                        label="Select Start"
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>End Date</label>
                      <CustomDatePicker
                        value={exportEndDate}
                        onChange={setExportEndDate}
                        label="Select End"
                      />
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.25rem 0' }} />

                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter by Status</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setFilterAbsent(!filterAbsent)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: filterAbsent ? '#ef4444' : 'rgba(239, 68, 68, 0.1)',
                        color: filterAbsent ? '#ffffff' : '#ef4444',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Absent Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterHoliday(!filterHoliday)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: filterHoliday ? '#f59e0b' : 'rgba(245, 158, 11, 0.1)',
                        color: filterHoliday ? '#ffffff' : '#f59e0b',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Holiday Only
                    </button>
                  </div>

                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.25rem 0' }} />

                  <button
                    onClick={() => {
                      setExportStartDate('');
                      setExportEndDate('');
                      setFilterAbsent(false);
                      setFilterHoliday(false);
                      setShowFilterMenu(false);
                    }}
                    style={{
                      padding: '8px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: 'none',
                      color: 'var(--danger)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
              )}

              <button
                className="btn-export"
                onClick={exportCSV}
                disabled={filteredAndPairedLogs.length === 0}
                style={{
                  opacity: filteredAndPairedLogs.length === 0 ? 0.5 : 1,
                  cursor: filteredAndPairedLogs.length === 0 ? 'not-allowed' : 'pointer',
                  margin: 0,
                  backgroundColor: 'rgba(52, 168, 83, 0.15)',
                  color: '#4ade80',
                  borderColor: 'rgba(52, 168, 83, 0.25)'
                }}
              >
                <SheetIcon />
                Sheets
              </button>
              <button
                className="btn-export"
                onClick={exportPDF}
                disabled={filteredAndPairedLogs.length === 0}
                style={{ opacity: filteredAndPairedLogs.length === 0 ? 0.5 : 1, cursor: filteredAndPairedLogs.length === 0 ? 'not-allowed' : 'pointer', margin: 0 }}
              >
                <DownloadIcon />
                PDF
              </button>
            </div>
          </div>
        </div>

        {filteredAndPairedLogs.length === 0 ? (
          <div className="empty-state">
            No records found for this period. Time in to start tracking!
          </div>
        ) : (
          <div className="history-list">
            <div className="table-header">
              <div>Date</div>
              <div>Time In</div>
              <div>L-Out</div>
              <div>L-In</div>
              <div>Time Out</div>
              <div>Hours</div>
              <div></div>
            </div>
            {[...filteredAndPairedLogs].reverse().map((row) => (
              <div key={row.id} className={`table-row ${row.timeIn === 'ABSENT' ? 'row-absent' :
                row.timeIn === 'HOLIDAY' ? 'row-holiday' :
                  row.timeIn === 'REST DAY' ? 'row-rest' : ''
                }`}>
                <div className="cell-date">{row.date}</div>
                <div className={`cell-time ${row.timeIn === 'ABSENT' ? 'cell-absent' :
                  row.timeIn === 'HOLIDAY' ? 'cell-holiday' :
                    row.timeIn === 'REST DAY' ? 'cell-rest' :
                      row.timeIn !== '-' ? 'active' : ''
                  }`}>
                  {row.timeIn}
                </div>
                <div className="cell-time">{row.lunchOut}</div>
                <div className="cell-time">{row.lunchIn}</div>
                <div className={`cell-time cell-timeout ${row.timeOut === '-' && !row.timeIn.includes('ABSENT') && !row.timeIn.includes('REST') && !row.timeIn.includes('HOLIDAY') ? 'inactive' : ''}`}>
                  {row.timeOut === '-'
                    ? (row.timeIn.includes('ABSENT') || row.timeIn.includes('REST') || row.timeIn.includes('HOLIDAY') ? '-' : 'Pending...')
                    : row.timeOut}
                </div>
                <div className="cell-time" style={{ fontWeight: 'bold' }}>
                  {row.totalHours !== '-' ? row.totalHours : '-'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {row.logIds && row.logIds.length > 0 && (
                    <button
                      onClick={() => handleDeleteDay(row.logIds)}
                      className="btn-export"
                      style={{ padding: '4px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none' }}
                      title="Delete Record"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
