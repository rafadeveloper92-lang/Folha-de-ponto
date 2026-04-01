import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  User, 
  Clock, 
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Save,
  MoreVertical,
  Settings,
  History,
  DollarSign,
  X,
  PenTool,
  Upload,
  Database,
  Share2,
  Sun,
  Moon
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WorkMonth, WorkDay } from './types';
import { cn } from './lib/utils';
import { PDFTemplate } from './components/PDFTemplate';
import SignatureCanvas from 'react-signature-canvas';
import type { UserProfile, WorkEntry } from './lib/db';
import {
  clearMonth,
  deleteEntryDay,
  initStorage,
  loadAllEntries,
  loadEntriesForMonth,
  loadProfile,
  replaceMonthEntries,
  restoreData,
  saveProfile,
} from './lib/storage';
import { playShortBeep } from './lib/beep';
import { downloadPdfBlob, renderElementToPdfBlob, shareOrDownloadPdf } from './lib/pdfHelpers';

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Oficial' | 'Ajudante' | ''>('');
  const [entries, setEntries] = useState<Record<string, Partial<WorkDay>>>({});
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [signature, setSignature] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [history, setHistory] = useState<{ month: string, hours: number, days: number }[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [defaultProject, setDefaultProject] = useState('');
  
  const pdfRef = useRef<HTMLDivElement>(null);
  const sigPad = useRef<SignatureCanvas>(null);
  const isInitialMount = useRef(true);
  const isChangingMonth = useRef(false);

  const monthKey = format(currentDate, 'MM_yyyy');

  // PWA Install Logic
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Load profile and entries (SQLite nativo no Android; Dexie no navegador)
  useEffect(() => {
    const loadData = async () => {
      await initStorage();
      const profile = await loadProfile();
      if (profile) {
        setName(profile.name);
        setRole(profile.role as any);
        setHourlyRate(profile.hourlyRate);
        setSignature(profile.signature || null);
        setTheme(profile.theme ?? 'light');
        if (profile.defaultProject) setDefaultProject(profile.defaultProject);
      }

      const savedEntries = await loadEntriesForMonth(monthKey);
      const entriesMap: Record<string, Partial<WorkDay>> = {};
      savedEntries.forEach(entry => {
        entriesMap[entry.day] = {
          day: entry.day,
          project: entry.project,
          description: entry.description,
          hours: entry.hours,
          marked: entry.marked
        };
      });
      setEntries(entriesMap);
      
      isInitialMount.current = false;
    };
    loadData();
  }, [monthKey]);

  // Load history
  useEffect(() => {
    const loadHistory = async () => {
      const allEntries = await loadAllEntries();
      const historyMap: Record<string, { hours: number, days: Set<number> }> = {};
      
      allEntries.forEach(entry => {
        if (!historyMap[entry.monthKey]) {
          historyMap[entry.monthKey] = { hours: 0, days: new Set() };
        }
        const match = entry.hours.match(/\d+/);
        historyMap[entry.monthKey].hours += match ? parseInt(match[0]) : 0;
        historyMap[entry.monthKey].days.add(entry.day);
      });

      const historyData = Object.entries(historyMap).map(([monthKey, data]) => ({
        month: monthKey.replace('_', '/'),
        hours: data.hours,
        days: data.days.size
      })).sort((a, b) => {
        const [mA, yA] = a.month.split('/').map(Number);
        const [mB, yB] = b.month.split('/').map(Number);
        return yB !== yA ? yB - yA : mB - mA;
      });
      setHistory(historyData);
    };
    loadHistory();
  }, [entries]);

  useEffect(() => {
    if (isInitialMount.current) return;
    const p: UserProfile = {
      id: 'current',
      name,
      role,
      hourlyRate,
      signature: signature || '',
      theme,
      defaultProject,
    };
    void saveProfile(p);
  }, [name, role, hourlyRate, signature, theme, defaultProject]);

  useEffect(() => {
    if (isInitialMount.current) return;

    const saveEntries = async () => {
      const entriesToSave: WorkEntry[] = Object.entries(entries).map(([day, data]) => ({
        monthKey,
        day: parseInt(day, 10),
        project: data.project || '',
        description: data.description || '',
        hours: data.hours || '',
        marked: data.marked || false,
      }));

      await replaceMonthEntries(monthKey, entriesToSave);
    };

    void saveEntries();
  }, [entries, monthKey]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const hourOptions = Array.from({ length: 11 }, (_, i) => `${i + 5} horas`);

  const handleInputChange = (day: number, field: keyof WorkDay, value: string) => {
    if (entries[day]?.marked) return;
    setEntries(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        day,
        [field]: value
      }
    }));
  };

  const handleMarkDay = (day: number) => {
    if (!entries[day]?.hours || !entries[day]?.project) {
      // Optional: show a toast or alert
      return;
    }
    setEntries(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        day,
        marked: true
      }
    }));
    
    void playShortBeep();
    setSavingDay(day);
    setTimeout(() => setSavingDay(null), 1000);
  };

  const handleMarkOffDay = (day: number) => {
    setEntries(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        day,
        hours: '0 horas',
        project: 'FOLGA / FERIADO',
        marked: true,
        isOffDay: true
      }
    }));
    
    void playShortBeep();
    setSavingDay(day);
    setTimeout(() => setSavingDay(null), 1000);
  };

  const handleResetDay = (day: number) => {
    if (confirm('Deseja desmarcar este dia?')) {
      setEntries(prev => {
        const newEntries = { ...prev };
        delete newEntries[day];
        return newEntries;
      });
      void deleteEntryDay(day, monthKey);
    }
  };

  const applyDefaultProject = () => {
    if (!defaultProject) return;
    setEntries(prev => {
      const newEntries = { ...prev };
      days.forEach(day => {
        const dayNum = day.getDate();
        if (newEntries[dayNum]?.marked) return;
        
        if (!newEntries[dayNum]) {
          newEntries[dayNum] = { day: dayNum, project: defaultProject, description: '', hours: '' };
        } else if (!newEntries[dayNum].project) {
          newEntries[dayNum].project = defaultProject;
        }
      });
      return newEntries;
    });
  };

  const markWeekendsAsOff = () => {
    setEntries(prev => {
      const newEntries = { ...prev };
      days.forEach(day => {
        const dayNum = day.getDate();
        const dayOfWeek = getDay(day); // 0 = Sunday, 6 = Saturday
        
        if ((dayOfWeek === 0 || dayOfWeek === 6) && !newEntries[dayNum]?.marked) {
          newEntries[dayNum] = {
            ...newEntries[dayNum],
            day: dayNum,
            hours: '0 horas',
            project: 'FOLGA / FERIADO',
            marked: true,
            isOffDay: true
          };
        }
      });
      return newEntries;
    });
    
    void playShortBeep();
  };

  const pdfFileBase = () =>
    `GSI_Ponto_${(name || 'Funcionario').replace(/\s+/g, '_')}_${format(currentDate, 'MM_yyyy')}.pdf`;

  const shareToWhatsApp = async () => {
    if (!pdfRef.current) return;
    setIsExporting(true);

    try {
      const blob = await renderElementToPdfBlob(pdfRef.current);
      const fileName = pdfFileBase();
      const shareText = `Ponto GSI — ${format(currentDate, 'MMMM yyyy', { locale: ptBR })}`;
      await shareOrDownloadPdf(blob, fileName, 'Ponto GSI', shareText);
    } catch (error) {
      console.error('Error sharing PDF:', error);
      alert('Não foi possível gerar o PDF. Verifique se há dados e tente de novo.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportPDF = async () => {
    if (!pdfRef.current) return;
    setIsExporting(true);

    try {
      const blob = await renderElementToPdfBlob(pdfRef.current);
      downloadPdfBlob(blob, pdfFileBase());
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Houve um erro ao gerar o PDF. Por favor, tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearSignature = () => {
    if (sigPad.current) {
      sigPad.current.clear();
    }
  };

  const trimCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const l = pixels.data.length;
    const bound = {
      top: canvas.height,
      left: canvas.width,
      right: 0,
      bottom: 0
    };
    
    for (let i = 0; i < l; i += 4) {
      if (pixels.data[i + 3] !== 0) {
        const x = (i / 4) % canvas.width;
        const y = Math.floor((i / 4) / canvas.width);
        
        if (x < bound.left) bound.left = x;
        if (x > bound.right) bound.right = x;
        if (y < bound.top) bound.top = y;
        if (y > bound.bottom) bound.bottom = y;
      }
    }
    
    const trimHeight = bound.bottom - bound.top + 1;
    const trimWidth = bound.right - bound.left + 1;
    
    if (trimWidth <= 0 || trimHeight <= 0) return canvas;
    
    const trimmed = ctx.getImageData(bound.left, bound.top, trimWidth, trimHeight);
    const copy = document.createElement('canvas');
    copy.width = trimWidth;
    copy.height = trimHeight;
    const copyCtx = copy.getContext('2d');
    if (!copyCtx) return canvas;
    copyCtx.putImageData(trimmed, 0, 0);
    
    return copy;
  };

  const handleSaveSignature = () => {
    if (sigPad.current) {
      if (sigPad.current.isEmpty()) {
        alert('Por favor, desenhe sua assinatura primeiro.');
        return;
      }
      const canvas = sigPad.current.getCanvas();
      const trimmedCanvas = trimCanvas(canvas);
      const dataUrl = trimmedCanvas.toDataURL('image/png');
      setSignature(dataUrl);
      setIsSignatureOpen(false);
    }
  };

  const handleBackupData = async () => {
    const profile = await loadProfile();
    const entries = await loadAllEntries();
    
    const backupData = {
      profile,
      entries
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gsi_backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestoreData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (confirm('Isso irá substituir todos os seus dados atuais. Deseja continuar?')) {
          await restoreData(data.profile, data.entries ?? []);
          window.location.reload();
        }
      } catch (err) {
        alert('Arquivo de backup inválido.');
      }
    };
    reader.readAsText(file);
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const totalHours = (Object.values(entries) as Partial<WorkDay>[]).reduce((acc: number, curr) => {
    if (curr.hours) {
      const match = curr.hours.match(/\d+/);
      return acc + (match ? parseInt(match[0]) : 0);
    }
    return acc;
  }, 0);

  const totalEarnings = totalHours * hourlyRate;

  const workMonthData: WorkMonth = {
    name,
    role,
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    days: (Object.values(entries) as Partial<WorkDay>[]).filter((e): e is WorkDay => e.day !== undefined),
    signature: signature || undefined,
    totalHours,
    totalEarnings
  };

  const copyPrevious = (dayNum: number) => {
    if (entries[dayNum]?.marked) return;
    const prevDay = dayNum - 1;
    if (entries[prevDay]) {
      setEntries(prev => ({
        ...prev,
        [dayNum]: {
          ...prev[dayNum],
          day: dayNum,
          project: entries[prevDay].project || prev[dayNum]?.project,
          description: entries[prevDay].description || prev[dayNum]?.description,
          hours: entries[prevDay].hours || prev[dayNum]?.hours,
        }
      }));
    }
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300 pb-10",
      theme === 'dark' ? "bg-black text-white" : "bg-slate-50 text-slate-900"
    )}>
      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className={cn(
              "fixed top-0 left-0 right-0 z-[100] p-4 shadow-2xl flex items-center justify-between",
              theme === 'dark' ? "bg-[#D4AF37]" : "bg-[#2563EB]"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 bg-white rounded-lg flex items-center justify-center font-black",
                theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"
              )}>G</div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Instalar GSI Tracker</p>
                <p className="text-[10px] opacity-80">Tenha o app direto no seu celular!</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowInstallBanner(false)}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 rounded-lg"
              >
                Agora não
              </button>
              <button 
                onClick={handleInstallClick}
                className={cn(
                  "px-4 py-2 bg-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg active:scale-95 transition-all",
                  theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"
                )}
              >
                Instalar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className={cn(
        "backdrop-blur-md border-b sticky top-0 z-30 shadow-lg",
        theme === 'dark' ? "bg-black/80 border-white/10" : "bg-white/80 border-slate-200"
      )}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-2xl shadow-lg",
              theme === 'dark' ? "bg-[#D4AF37] shadow-[#D4AF37]/50" : "bg-[#2563EB] shadow-[#2563EB]/50"
            )}>
              G
            </div>
            <h1 className={cn(
              "font-black text-xl tracking-tighter hidden sm:block",
              theme === 'dark' ? "text-white" : "text-slate-900"
            )}>GSI TRACKER</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn(
                "p-2 rounded-full transition-all active:scale-90",
                theme === 'dark' ? "bg-white/10 text-yellow-400 hover:bg-white/20" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
              )}
              title={theme === 'dark' ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button 
              onClick={shareToWhatsApp}
              disabled={isExporting}
              className="flex items-center gap-1.5 sm:gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
              title="Compartilhar PDF (WhatsApp ou outras apps)"
            >
              {isExporting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Share2 size={18} />
              )}
              <span className="hidden sm:inline">Partilhar</span>
            </button>

            <button 
              onClick={exportPDF}
              disabled={isExporting}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 text-white px-3 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all active:scale-95 disabled:opacity-50 shadow-lg",
                theme === 'dark' ? "bg-[#D4AF37] hover:bg-[#b8962f] shadow-[#D4AF37]/30" : "bg-[#2563EB] hover:bg-[#1d4ed8] shadow-[#2563EB]/30"
              )}
              title="Descarregar PDF"
            >
              {isExporting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download size={18} />
              )}
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button 
              onClick={() => setIsSettingsOpen(true)}
              className={cn(
                "p-2 rounded-full transition-colors",
                theme === 'dark' ? "hover:bg-white/10 text-white/70" : "hover:bg-slate-100 text-slate-400"
              )}
            >
              <MoreVertical size={24} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* User Info Card */}
        <section className={cn(
          "rounded-2xl p-6 shadow-xl border mb-8 transition-colors duration-300",
          theme === 'dark' ? "bg-[#111111] border-white/5" : "bg-white border-slate-200"
        )}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className={cn(
                "text-xs font-black flex items-center gap-2 uppercase tracking-widest",
                theme === 'dark' ? "text-white/40" : "text-slate-400"
              )}>
                <User size={12} /> NOME DO COLABORADOR
              </label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Digite seu nome completo"
                className={cn(
                  "w-full px-4 py-3 border rounded-xl focus:ring-2 outline-none transition-all placeholder:text-white/20",
                  theme === 'dark' ? "bg-black border-white/10 text-white focus:ring-[#D4AF37]" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-[#2563EB]"
                )}
              />
            </div>
            <div className="space-y-2">
              <label className={cn(
                "text-xs font-black flex items-center gap-2 uppercase tracking-widest",
                theme === 'dark' ? "text-white/40" : "text-slate-400"
              )}>
                <Briefcase size={12} /> CARGO
              </label>
              <div className="flex gap-4">
                {['Oficial', 'Ajudante'].map((option) => (
                  <button
                    key={option}
                    onClick={() => setRole(option as any)}
                    className={cn(
                      "flex-1 py-3 rounded-xl border font-bold transition-all active:scale-95 uppercase tracking-widest text-xs",
                      role === option 
                        ? theme === 'dark' ? "bg-[#D4AF37] border-[#D4AF37] text-white shadow-[#D4AF37]/30" : "bg-[#2563EB] border-[#2563EB] text-white shadow-[#2563EB]/30"
                        : theme === 'dark' 
                          ? "bg-black border-white/10 text-white/40 hover:border-white/20"
                          : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className={cn(
                "text-xs font-black flex items-center gap-2 uppercase tracking-widest",
                theme === 'dark' ? "text-white/40" : "text-slate-400"
              )}>
                <Briefcase size={12} /> OBRA PADRÃO (OPCIONAL)
              </label>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={defaultProject}
                  onChange={(e) => setDefaultProject(e.target.value)}
                  placeholder="Ex: San Carlos Can Brisa"
                  list="project-options"
                  className={cn(
                    "flex-grow px-4 py-3 border rounded-xl focus:ring-2 outline-none transition-all placeholder:text-white/20",
                    theme === 'dark' ? "bg-black border-white/10 text-white focus:ring-[#D4AF37]" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-[#2563EB]"
                  )}
                />
                <button 
                  onClick={applyDefaultProject}
                  className={cn(
                    "px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95",
                    theme === 'dark' ? "bg-[#D4AF37] text-white shadow-[#D4AF37]/30" : "bg-[#2563EB] text-white shadow-[#2563EB]/30"
                  )}
                >
                  APLICAR A TODOS
                </button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className={cn(
                "text-xs font-black flex items-center gap-2 uppercase tracking-widest",
                theme === 'dark' ? "text-white/40" : "text-slate-400"
              )}>
                <CalendarIcon size={12} /> PERÍODO
              </label>
              <div className={cn(
                "flex items-center justify-between border rounded-xl px-4 py-3",
                theme === 'dark' ? "bg-[#141414] border-white/10" : "bg-slate-50 border-slate-200"
              )}>
                <button onClick={() => changeMonth(-1)} className={cn(
                  "p-1 rounded-lg transition-colors",
                  theme === 'dark' ? "hover:bg-white/10" : "hover:bg-slate-200"
                )}>
                  <ChevronLeft size={20} />
                </button>
                <span className={cn(
                  "font-black uppercase tracking-widest",
                  theme === 'dark' ? "text-white" : "text-slate-900"
                )}>
                  {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <button onClick={() => changeMonth(1)} className={cn(
                  "p-1 rounded-lg transition-colors",
                  theme === 'dark' ? "hover:bg-white/10" : "hover:bg-slate-200"
                )}>
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className={cn(
                "text-xs font-black flex items-center gap-2 uppercase tracking-widest",
                theme === 'dark' ? "text-white/40" : "text-slate-400"
              )}>
                <PenTool size={12} /> ASSINATURA DIGITAL
              </label>
              <div className={cn(
                "flex items-center gap-4 p-4 border rounded-xl",
                theme === 'dark' ? "bg-[#141414] border-white/10" : "bg-slate-50 border-slate-200"
              )}>
                {signature ? (
                  <div className="flex-grow flex items-center justify-between">
                    <img src={signature} alt="Sua Assinatura" className={cn(
                      "h-12 object-contain rounded p-1",
                      theme === 'dark' ? "bg-white/5" : "bg-white shadow-sm"
                    )} />
                    <button 
                      onClick={() => setIsSignatureOpen(true)}
                      className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        theme === 'dark' ? "text-[#D4AF37] hover:text-[#b8962f]" : "text-[#2563EB] hover:text-[#1d4ed8]"
                      )}
                    >
                      ALTERAR ASSINATURA
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsSignatureOpen(true)}
                    className={cn(
                      "flex-grow flex items-center justify-center gap-2 py-2 border-2 border-dashed rounded-lg transition-all group",
                      theme === 'dark' ? "border-white/10 text-white/40 hover:border-[#D4AF37]/50 hover:text-white" : "border-slate-300 text-slate-400 hover:border-[#2563EB]/50 hover:text-slate-600"
                    )}
                  >
                    <PenTool size={16} className={cn(
                      "group-hover:text-current",
                      theme === 'dark' ? "group-hover:text-[#D4AF37]" : "group-hover:text-[#2563EB]"
                    )} />
                    <span className="text-[10px] font-black uppercase tracking-widest">ASSINAR AGORA</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Resumo do mês — separado das marcações */}
        <section
          className={cn(
            'rounded-2xl p-5 sm:p-6 shadow-lg border mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6',
            theme === 'dark'
              ? 'bg-[#141414] border-white/10'
              : 'bg-white border-slate-200',
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                theme === 'dark'
                  ? 'bg-[#D4AF37]/15 text-[#D4AF37]'
                  : 'bg-[#2563EB]/10 text-[#2563EB]',
              )}
            >
              <Clock size={22} />
            </div>
            <div>
              <p
                className={cn(
                  'text-[10px] font-black uppercase tracking-[0.2em] mb-1',
                  theme === 'dark' ? 'text-white/45' : 'text-slate-500',
                )}
              >
                Total de horas (mês)
              </p>
              <p
                className={cn(
                  'text-3xl font-black tabular-nums',
                  theme === 'dark' ? 'text-white' : 'text-slate-900',
                )}
              >
                {totalHours}
                <span
                  className={cn(
                    'text-sm font-semibold ml-1.5',
                    theme === 'dark' ? 'text-white/50' : 'text-slate-500',
                  )}
                >
                  h
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 sm:text-right sm:flex-row-reverse sm:justify-start">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                theme === 'dark' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600',
              )}
            >
              <DollarSign size={22} />
            </div>
            <div className="min-w-0 flex-1 sm:text-right">
              <p
                className={cn(
                  'text-[10px] font-black uppercase tracking-[0.2em] mb-1',
                  theme === 'dark' ? 'text-white/45' : 'text-slate-500',
                )}
              >
                Valor estimado
              </p>
              <p className="text-3xl font-black text-emerald-500 tabular-nums">
                €{totalEarnings.toFixed(2)}
              </p>
            </div>
          </div>
        </section>

        {/* Daily Entries */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className={cn(
              "text-xs font-black uppercase tracking-[0.2em]",
              theme === 'dark' ? "text-white/40" : "text-slate-400"
            )}>MARCAÇÕES DIÁRIAS</h2>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  if (confirm('Tem certeza que deseja limpar todos os dados deste mês?')) {
                    setEntries({});
                    void clearMonth(monthKey);
                  }
                }}
                className={cn(
                  "text-[10px] font-black flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all uppercase tracking-widest",
                  theme === 'dark' ? "text-[#D4AF37] hover:text-[#b8962f] hover:bg-[#D4AF37]/10" : "text-[#2563EB] hover:text-[#1d4ed8] hover:bg-[#2563EB]/10"
                )}
              >
                <Trash2 size={12} /> LIMPAR MÊS
              </button>
              <span className={cn(
                "text-sm",
                theme === 'dark' ? "text-slate-500" : "text-slate-400"
              )}>{days.length} dias no mês</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {days.map((day, idx) => {
                const dayNum = day.getDate();
                const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                
                return (
                  <motion.div 
                    key={day.toISOString()}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={cn(
                      "rounded-2xl p-4 shadow-xl border transition-all duration-300",
                      entries[dayNum]?.isOffDay 
                        ? theme === 'dark' ? "border-white/5 bg-white/5 opacity-60" : "border-slate-100 bg-slate-50 opacity-60"
                        : theme === 'dark' 
                          ? isWeekend ? "border-[#D4AF37]/20 bg-black/80 hover:border-white/20" : "border-white/5 bg-black hover:border-white/20"
                          : isWeekend ? "border-[#2563EB]/20 bg-slate-100 hover:border-slate-300" : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Day Indicator */}
                      <div className="flex items-center gap-3 md:w-24 shrink-0">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black",
                          isWeekend 
                            ? theme === 'dark' ? "bg-[#D4AF37] text-white shadow-[#D4AF37]/30" : "bg-[#2563EB] text-white shadow-[#2563EB]/30"
                            : theme === 'dark' ? "bg-black text-white/60" : "bg-slate-200 text-slate-600"
                        )}>
                          <span className="text-[10px] leading-none uppercase tracking-tighter">{format(day, 'EEE', { locale: ptBR })}</span>
                          <span className="text-xl leading-none">{dayNum}</span>
                        </div>
                        <div className={cn(
                          "md:hidden font-black uppercase tracking-widest text-xs flex items-center gap-2",
                          theme === 'dark' ? "text-white/80" : "text-slate-700"
                        )}>
                           {format(day, 'EEEE', { locale: ptBR })}
                           {isWeekend && (
                             <span className={cn(
                               "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter",
                               theme === 'dark' ? "bg-[#D4AF37]/20 text-[#D4AF37]" : "bg-[#2563EB]/20 text-[#2563EB]"
                             )}>FDS</span>
                           )}
                           {entries[dayNum]?.isOffDay && (
                             <span className={cn(
                               "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter",
                               theme === 'dark' ? "bg-white/10 text-white/40" : "bg-slate-200 text-slate-500"
                             )}>FOLGA</span>
                           )}
                        </div>
                      </div>

                      {/* Inputs */}
                      <div className={cn(
                        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-grow",
                        entries[dayNum]?.isOffDay && "opacity-80"
                      )}>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className={cn(
                              "text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                              theme === 'dark' ? "text-white/30" : "text-slate-400"
                            )}>
                              <Clock size={10} /> HORAS
                            </label>
                            {dayNum > 1 && !entries[dayNum]?.marked && (
                              <button 
                                onClick={() => copyPrevious(dayNum)}
                                className={cn(
                                  "text-[10px] font-black flex items-center gap-0.5 uppercase tracking-widest",
                                  theme === 'dark' ? "text-[#D4AF37] hover:text-[#b8962f]" : "text-[#2563EB] hover:text-[#1d4ed8]"
                                )}
                                title="Copiar do dia anterior"
                              >
                                <Plus size={10} /> REPETIR
                              </button>
                            )}
                          </div>
                          <select 
                            disabled={entries[dayNum]?.marked}
                            value={entries[dayNum]?.hours || ''}
                            onChange={(e) => handleInputChange(dayNum, 'hours', e.target.value)}
                            className={cn(
                              "w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none text-sm appearance-none cursor-pointer",
                              theme === 'dark' ? "bg-black border-white/10 text-white focus:ring-[#D4AF37]" : "bg-white border-slate-200 text-slate-900 focus:ring-[#2563EB]",
                              entries[dayNum]?.marked && "opacity-60 cursor-not-allowed"
                            )}
                          >
                            <option value="">Selecione</option>
                            {hourOptions.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className={cn(
                            "text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                            theme === 'dark' ? "text-white/30" : "text-slate-400"
                          )}>
                            <Briefcase size={10} /> OBRA
                          </label>
                          <input 
                            type="text" 
                            placeholder="Nome da obra"
                            list="project-options"
                            disabled={entries[dayNum]?.marked}
                            value={entries[dayNum]?.project || ''}
                            onChange={(e) => handleInputChange(dayNum, 'project', e.target.value)}
                            className={cn(
                              "w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none text-sm",
                              theme === 'dark' ? "bg-black border-white/10 text-white focus:ring-[#D4AF37] placeholder:text-white/10" : "bg-white border-slate-200 text-slate-900 focus:ring-[#2563EB] placeholder:text-slate-300",
                              entries[dayNum]?.marked && "opacity-60 cursor-not-allowed"
                            )}
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <button
                            disabled={entries[dayNum]?.marked || !entries[dayNum]?.hours || !entries[dayNum]?.project}
                            onClick={() => handleMarkDay(dayNum)}
                            className={cn(
                              "flex-1 py-2 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2",
                              entries[dayNum]?.marked
                                ? entries[dayNum]?.isOffDay 
                                  ? "hidden" 
                                  : "bg-emerald-500 text-white shadow-emerald-500/30 cursor-default"
                                : (!entries[dayNum]?.hours || !entries[dayNum]?.project)
                                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                                  : theme === 'dark' 
                                    ? "bg-[#D4AF37] text-white shadow-[#D4AF37]/30 hover:bg-[#b8962f]" 
                                    : "bg-[#2563EB] text-white shadow-[#2563EB]/30 hover:bg-[#1d4ed8]"
                            )}
                          >
                            {entries[dayNum]?.marked ? (
                              <>MARCADO!</>
                            ) : (
                              <><Save size={12} /> MARCA PONTO</>
                            )}
                          </button>

                          {!entries[dayNum]?.marked && (
                            <button
                              onClick={() => handleMarkOffDay(dayNum)}
                              className={cn(
                                "py-2 px-4 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2 border-2",
                                theme === 'dark' 
                                  ? "border-white/10 text-white/50 hover:bg-white/5" 
                                  : "border-slate-200 text-slate-400 hover:bg-slate-50"
                              )}
                              title="Marcar como Folga ou Feriado"
                            >
                              FOLGA
                            </button>
                          )}

                          {entries[dayNum]?.marked && (
                            <button
                              onClick={() => handleResetDay(dayNum)}
                              className={cn(
                                "p-2 rounded-lg transition-all active:scale-95",
                                theme === 'dark' ? "bg-white/5 text-white/40 hover:bg-white/10" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                              )}
                              title="Desmarcar este dia"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}

                          {entries[dayNum]?.isOffDay && (
                            <div className="flex-1 py-2 rounded-lg font-black uppercase tracking-widest text-[10px] bg-slate-500 text-white flex items-center justify-center gap-2">
                              FOLGA / FERIADO
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Settings & History Sheet */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "fixed right-0 top-0 bottom-0 w-full max-w-md z-50 shadow-2xl flex flex-col border-l",
                theme === 'dark' ? "bg-[#1f1f1f] border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className={cn(
                "p-6 border-b flex items-center justify-between",
                theme === 'dark' ? "border-white/5" : "border-slate-100"
              )}>
                <div className="flex items-center gap-2">
                  <Settings className={cn(
                    theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"
                  )} size={24} />
                  <h2 className={cn(
                    "text-xl font-black uppercase tracking-tighter",
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}>CONFIGURAÇÕES</h2>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)} 
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    theme === 'dark' ? "hover:bg-white/10 text-white/60" : "hover:bg-slate-100 text-slate-400"
                  )}
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-6 space-y-8">
                {/* Hourly Rate Section */}
                <section className="space-y-4">
                  <div className={cn(
                    "flex items-center gap-2",
                    theme === 'dark' ? "text-white/80" : "text-slate-600"
                  )}>
                    <DollarSign size={20} className="text-emerald-500" />
                    <h3 className="font-black uppercase tracking-widest text-xs">VALOR POR HORA</h3>
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl border space-y-3",
                    theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-slate-50 border-slate-200"
                  )}>
                    <p className={cn(
                      "text-[10px] uppercase tracking-widest font-bold",
                      theme === 'dark' ? "text-white/40" : "text-slate-400"
                    )}>DEFINA SEU GANHO POR HORA</p>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <DollarSign size={16} className="text-emerald-500" />
                        <span className="font-black text-emerald-500">€</span>
                      </div>
                      <input 
                        type="number" 
                        value={hourlyRate || ''}
                        onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className={cn(
                          "w-full pl-14 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-black text-emerald-500",
                          theme === 'dark' ? "bg-[#1f1f1f] border-white/10" : "bg-white border-slate-200"
                        )}
                      />
                    </div>
                  </div>
                </section>

                {/* Quick Actions Section */}
                <section className="space-y-4">
                  <div className={cn(
                    "flex items-center gap-2",
                    theme === 'dark' ? "text-white/80" : "text-slate-600"
                  )}>
                    <CalendarIcon size={20} className={theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"} />
                    <h3 className="font-black uppercase tracking-widest text-xs">AÇÕES RÁPIDAS</h3>
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl border space-y-4",
                    theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-slate-50 border-slate-200"
                  )}>
                    <button 
                      onClick={markWeekendsAsOff}
                      className={cn(
                        "w-full py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2",
                        theme === 'dark' ? "bg-white/5 text-white hover:bg-white/10" : "bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                      )}
                    >
                      <CalendarIcon size={14} /> MARCAR FINAIS DE SEMANA COMO FOLGA
                    </button>
                    <p className={cn(
                      "text-[8px] uppercase tracking-widest font-bold text-center",
                      theme === 'dark' ? "text-white/20" : "text-slate-400"
                    )}>ÚTIL PARA PREENCHER O MÊS MAIS RÁPIDO</p>
                  </div>
                </section>

                {/* Backup & Restore Section */}
                <section className="space-y-4">
                  <div className={cn(
                    "flex items-center gap-2",
                    theme === 'dark' ? "text-white/80" : "text-slate-600"
                  )}>
                    <Database size={20} />
                    <h3 className="font-black uppercase tracking-widest text-xs">DADOS E BACKUP</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={handleBackupData}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 border rounded-2xl transition-all group",
                        theme === 'dark' ? "bg-[#141414] border-white/5 hover:border-[#D4AF37]/50" : "bg-slate-50 border-slate-200 hover:border-[#2563EB]/50"
                      )}
                    >
                      <Download className={cn(
                        "group-hover:scale-110 transition-transform",
                        theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"
                      )} size={24} />
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        theme === 'dark' ? "text-white/60" : "text-slate-500"
                      )}>BACKUP</span>
                    </button>
                    <label className={cn(
                      "flex flex-col items-center justify-center gap-2 p-4 border rounded-2xl transition-all group cursor-pointer",
                      theme === 'dark' ? "bg-[#141414] border-white/5 hover:border-[#D4AF37]/50" : "bg-slate-50 border-slate-200 hover:border-[#2563EB]/50"
                    )}>
                      <Upload className={cn(
                        "group-hover:scale-110 transition-transform",
                        theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"
                      )} size={24} />
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        theme === 'dark' ? "text-white/60" : "text-slate-500"
                      )}>RESTAURAR</span>
                      <input type="file" accept=".json" onChange={handleRestoreData} className="hidden" />
                    </label>
                  </div>
                </section>

                {/* History Section */}
                <section className="space-y-4">
                  <div className={cn(
                    "flex items-center gap-2",
                    theme === 'dark' ? "text-white/80" : "text-slate-600"
                  )}>
                    <History size={20} />
                    <h3 className="font-black uppercase tracking-widest text-xs">HISTÓRICO DE MESES</h3>
                  </div>
                  <div className="space-y-3">
                    {history.length === 0 ? (
                      <div className={cn(
                        "text-center py-8 italic text-xs uppercase tracking-widest",
                        theme === 'dark' ? "text-white/20" : "text-slate-300"
                      )}>
                        NENHUM HISTÓRICO ENCONTRADO.
                      </div>
                    ) : (
                      history.map((item) => (
                        <div key={item.month} className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border",
                          theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-slate-50 border-slate-200"
                        )}>
                          <div>
                            <p className={cn(
                              "font-black uppercase tracking-tighter",
                              theme === 'dark' ? "text-white" : "text-slate-900"
                            )}>{item.month}</p>
                            <p className={cn(
                              "text-[10px] uppercase tracking-widest font-bold",
                              theme === 'dark' ? "text-white/40" : "text-slate-400"
                            )}>{item.days} DIAS TRABALHADOS</p>
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              "font-black uppercase tracking-tighter",
                              theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"
                            )}>{item.hours}H</p>
                            {hourlyRate > 0 && (
                              <div className="flex items-center justify-end gap-0.5">
                                <DollarSign size={10} className="text-emerald-500" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                                  € {(item.hours * hourlyRate).toFixed(2)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>

              <div className={cn(
                "p-6 border-t",
                theme === 'dark' ? "border-white/5 bg-[#141414]" : "border-slate-100 bg-slate-50"
              )}>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className={cn(
                    "w-full py-4 text-white rounded-2xl font-black uppercase tracking-[0.2em] active:scale-95 transition-all",
                    theme === 'dark' ? "bg-[#D4AF37] shadow-[#D4AF37]/30" : "bg-[#2563EB] shadow-[#2563EB]/30"
                  )}
                >
                  SALVAR E FECHAR
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Signature Modal */}
      <AnimatePresence>
        {isSignatureOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSignatureOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg z-[70] rounded-3xl shadow-2xl border flex flex-col overflow-hidden",
                theme === 'dark' ? "bg-[#1f1f1f] border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className={cn(
                "p-6 border-b flex items-center justify-between",
                theme === 'dark' ? "border-white/5 bg-[#141414]" : "border-slate-100 bg-slate-50"
              )}>
                <div className="flex items-center gap-2">
                  <PenTool className={cn(
                    theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"
                  )} size={20} />
                  <h2 className={cn(
                    "text-sm font-black uppercase tracking-widest",
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}>ASSINATURA DIGITAL</h2>
                </div>
                <button 
                  onClick={() => setIsSignatureOpen(false)} 
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    theme === 'dark' ? "hover:bg-white/10 text-white/40" : "hover:bg-slate-100 text-slate-400"
                  )}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 bg-white m-4 rounded-2xl shadow-inner">
                <SignatureCanvas 
                  ref={sigPad}
                  penColor="black"
                  canvasProps={{
                    className: "w-full h-64 cursor-crosshair"
                  }}
                />
              </div>

              <div className={cn(
                "p-6 border-t flex gap-3",
                theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-slate-50 border-slate-100"
              )}>
                <button 
                  onClick={handleClearSignature}
                  className={cn(
                    "flex-1 py-4 border rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all",
                    theme === 'dark' ? "border-white/10 text-white/60 hover:bg-white/5" : "border-slate-200 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  LIMPAR
                </button>
                <button 
                  onClick={handleSaveSignature}
                  className={cn(
                    "flex-1 py-4 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all",
                    theme === 'dark' ? "bg-[#D4AF37] shadow-[#D4AF37]/30" : "bg-[#2563EB] shadow-[#2563EB]/30"
                  )}
                >
                  SALVAR ASSINATURA
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <PDFTemplate data={workMonthData} innerRef={pdfRef} />
      <datalist id="project-options">
        <option value="San Carlos Can Brisa" />
      </datalist>
    </div>
  );
}
