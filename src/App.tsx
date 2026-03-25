import { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';

// Icons embedded as SVG components
const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const LogInIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
  </svg>
);

const LogOutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const SheetIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
  </svg>
);


const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
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

  // Manual Entry State
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualType, setManualType] = useState<'SHIFT' | 'ABSENT' | 'HOLIDAY'>('SHIFT');
  const [manualDate, setManualDate] = useState('');
  const [manualTimeIn, setManualTimeIn] = useState('');
  const [manualTimeOut, setManualTimeOut] = useState('');

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

  // Memoized pairing logic for UI & Exports
  const filteredAndPairedLogs = useMemo(() => {
    let filteredLogs = [...logs];
    if (exportStartDate) {
      const start = new Date(exportStartDate);
      start.setHours(0, 0, 0, 0);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= start);
    }
    if (exportEndDate) {
      const end = new Date(exportEndDate);
      end.setHours(23, 59, 59, 999);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= end);
    }
    
    const sortedLogs = [...filteredLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const pairedData = [];
    let currentPair: { date: string, timeIn: string, timeOut: string, rawIn: Date | null, rawOut: Date | null } | null = null;

    const buildOutput = (pair: any) => {
      let totalHours = '-';
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

        const workMs = (pair.rawOut.getTime() - pair.rawIn.getTime()) - breakTimeMs;
        let finalHoursNum = workMs / (1000 * 60 * 60);
        
        // Special rule: If it's Saturday and they rendered >= 3 hours, max it out precisely to 8 hours
        if (pair.rawIn.getDay() === 6 && finalHoursNum >= 3) {
          finalHoursNum = 8;
        }

        totalHours = Math.round(finalHoursNum).toString();
      }
      return {
        id: crypto.randomUUID(),
        date: pair.date,
        timeIn: pair.timeIn,
        lunchOut: '12:00 PM',
        lunchIn: '01:00 PM',
        timeOut: pair.timeOut,
        totalHours
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
        currentPair = { date: dateStr, timeIn: timeStr, timeOut: '-', rawIn: logDate, rawOut: null };
      } else if (log.type === 'TIME_OUT') {
        if (currentPair && currentPair.date === dateStr) {
          currentPair.timeOut = timeStr;
          currentPair.rawOut = logDate;
          pairedData.push(buildOutput(currentPair));
          currentPair = null;
        } else {
          if (currentPair) pairedData.push(buildOutput(currentPair));
          pairedData.push(buildOutput({ date: dateStr, timeIn: '-', timeOut: timeStr, rawIn: null, rawOut: logDate }));
          currentPair = null;
        }
      } else if (log.type === 'ABSENT' || log.type === 'HOLIDAY') {
        if (currentPair) pairedData.push(buildOutput(currentPair));
        pairedData.push({
          id: crypto.randomUUID(),
          date: dateStr,
          timeIn: log.type,
          lunchOut: '-',
          lunchIn: '-',
          timeOut: '-',
          totalHours: '-'
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
    const start = exportStartDate ? new Date(exportStartDate) : minRawDate;
    
    // Always stop at today natively unless exportEndDate is earlier
    const end = exportEndDate ? new Date(exportEndDate) : new Date();
    
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
            totalHours: '-'
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return finalData;
  }, [logs, exportStartDate, exportEndDate]);

  const exportCSV = () => {
    if (!currentUser) return;
    if (filteredAndPairedLogs.length === 0) {
      alert('No records found in the selected date range.');
      return;
    }

    const headers = ['Date', 'Time In', 'L-Out', 'L-In', 'Time Out', 'Hours'];
    const rows = filteredAndPairedLogs.map(row => [row.date, row.timeIn, row.lunchOut, row.lunchIn, row.timeOut, row.totalHours]);
    
    const escapeCSV = (field: string) => `"${field.replace(/"/g, '""')}"`;

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Add BOM for proper UTF-8 handling in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `DTR_Export_${currentUser.username}_${new Date().getTime()}.csv`);
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
    const displayStart = exportStartDate ? new Date(exportStartDate).toLocaleDateString() : firstDataDate;
    const displayEnd = exportEndDate ? new Date(exportEndDate).toLocaleDateString() : lastDataDate;

    doc.text(`Period: ${displayStart} to ${displayEnd}`, 14, 39);

    const tableData = filteredAndPairedLogs.map(row => [row.date, row.timeIn, row.lunchOut, row.lunchIn, row.timeOut, row.totalHours]);

    // Render table
    autoTable(doc, {
      startY: 45,
      head: [['Date', 'Time In', 'L-Out', 'L-In', 'Time Out', 'Hours']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });

    doc.save(`DTR_Export_${currentUser.username}_${new Date().getTime()}.pdf`);
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
              <input type="date" className="date-input" value={manualDate} onChange={e => setManualDate(e.target.value)} required max={new Date().toISOString().split('T')[0]} />
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
          <div className="history-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
            <span>Your Records</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="date" 
                className="date-input" 
                value={exportStartDate} 
                onChange={e => setExportStartDate(e.target.value)} 
                title="Start Date"
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>to</span>
              <input 
                type="date" 
                className="date-input" 
                value={exportEndDate} 
                onChange={e => setExportEndDate(e.target.value)} 
                title="End Date"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
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
            </div>
            {[...filteredAndPairedLogs].reverse().map((row) => (
              <div key={row.id} className="table-row">
                <div className="cell-date">{row.date}</div>
                <div className={`cell-time ${row.timeIn !== '-' ? 'active' : ''}`}>
                  {row.timeIn}
                </div>
                <div className="cell-time">{row.lunchOut}</div>
                <div className="cell-time">{row.lunchIn}</div>
                <div className={`cell-time ${row.timeOut === '-' && !row.timeIn.includes('ABSENT') && !row.timeIn.includes('REST') && !row.timeIn.includes('HOLIDAY') ? 'inactive' : ''}`}>
                  {row.timeOut === '-' 
                    ? (row.timeIn.includes('ABSENT') || row.timeIn.includes('REST') || row.timeIn.includes('HOLIDAY') ? '-' : 'Pending...') 
                    : row.timeOut}
                </div>
                <div className="cell-time" style={{ fontWeight: 'bold' }}>
                  {row.totalHours !== '-' ? `${row.totalHours} h` : '-'}
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
