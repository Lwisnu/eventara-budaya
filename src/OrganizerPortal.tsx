import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { auth, type AuthUser } from '@appdeploy/client';
import { api } from '@appdeploy/client';
import {
  ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, Clock3,
  FileText, ImagePlus, LogOut, MapPin, Plus, ShieldCheck, UploadCloud, UserRound,
  X, Building2, ExternalLink, AlertCircle, Save, Eye, History, Settings,
  Users, UserPlus, UserMinus, Activity, LayoutDashboard
} from 'lucide-react';

type Status = 'draft' | 'pending' | 'revision' | 'published' | 'rejected' | 'cancellation_requested' | 'cancelled';
type OrganizerProfile = {
  displayName: string;
  type: 'individual' | 'organization';
  description: string;
  city: string;
  logoUrl?: string;
  website?: string;
  socialLink?: string;
};
type EventRecord = {
  id: string;
  ownerId: string;
  title: string;
  category: string;
  description: string;
  culturalRelevance: string;
  posterUrl?: string;
  posterPath?: string;
  supportingLinks: string[];
  responsibilityLetterName?: string;
  format: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  address: string;
  district: string;
  mapLink: string;
  latitude?: number;
  longitude?: number;
  ticketType: 'Gratis' | 'Berbayar';
  ticketPrice: string;
  ticketLink: string;
  registrationInfo: string;
  status: Status;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  history: Array<{ at: string; action: string; note?: string }>;
};
type PortalData = { profile: OrganizerProfile | null; events: EventRecord[]; role?: 'superadmin' | 'admin' | 'organizer' | 'visitor'; user: { userId: string; email?: string; name?: string } };

const emptyForm = {
  title: '', category: 'Seni pertunjukan', description: '', culturalRelevance: '',
  format: 'Luring', startDate: '', endDate: '', startTime: '', endTime: '',
  venue: '', address: '', district: 'Kota Yogyakarta', mapLink: '', latitude: '', longitude: '',
  ticketType: 'Gratis' as 'Gratis' | 'Berbayar', ticketPrice: '', ticketLink: '',
  registrationInfo: '', supportingLinksText: '', responsibilityLetterName: '',
};
type EventForm = typeof emptyForm;
const categories = ['Seni pertunjukan', 'Musik tradisional', 'Pameran & seni rupa', 'Tradisi & upacara', 'Festival & kirab', 'Workshop budaya', 'Sastra & diskusi', 'Kuliner & kriya', 'Film & audiovisual', 'Lainnya'];
const statusLabel: Record<Status, string> = { draft: 'Draf', pending: 'Menunggu verifikasi', revision: 'Perlu revisi', published: 'Diterbitkan', rejected: 'Ditolak', cancellation_requested: 'Menunggu pembatalan', cancelled: 'Dibatalkan' };

function statusClass(status: Status) {
  return 'portal-status status-' + status;
}
function dateLabel(value?: string) {
  if (!value) return 'Tanggal belum diatur';
  return new Date(value + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function asBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('File tidak dapat dibaca.'));
    reader.readAsDataURL(file);
  });
}

export default function OrganizerPortal({ onClose }: { onClose: () => void }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<PortalData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState<'dashboard' | 'profile' | 'form' | 'admin' | 'superadmin'>('dashboard');
  const [profileForm, setProfileForm] = useState<OrganizerProfile>({ displayName: '', type: 'individual', description: '', city: 'Yogyakarta', website: '', socialLink: '' });
  const [profileSaved, setProfileSaved] = useState(false);
  const [form, setForm] = useState<EventForm>({ ...emptyForm });
  const [eventId, setEventId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<Status>('draft');
  const [draftSaveStatus, setDraftSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const draftIdRef = useRef<string | null>(null);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSaveVersion = useRef(0);
  const [step, setStep] = useState(1);
  const [poster, setPoster] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState('');
  const [letter, setLetter] = useState<File | null>(null);
  const [adminEvents, setAdminEvents] = useState<EventRecord[]>([]);
  const [adminFilter, setAdminFilter] = useState('pending');
  const [adminNote, setAdminNote] = useState<Record<string, string>>({});
  const [adminMode, setAdminMode] = useState(false);
  const [superadminTab, setSuperadminTab] = useState<'overview' | 'admins' | 'audit'>('overview');
  const [superadminStats, setSuperadminStats] = useState<Record<string, number | string | null>>({});
  const [managedAdmins, setManagedAdmins] = useState<Array<{email:string;active:boolean;createdAt?:string;updatedAt?:string}>>([]);
  const [auditEntries, setAuditEntries] = useState<Array<{actorEmail:string;action:string;target?:string;details?:string;createdAt:string}>>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const refresh = async () => {
    const response = await api.get('/api/organizer/me');
    const payload = response.data as PortalData;
    setData(payload);
    setUser(await auth.getUser());
    if (payload.profile) setProfileForm({ ...payload.profile });
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await auth.getUser();
        if (!active) return;
        setUser(current);
        if (current) {
          const response = await api.get('/api/organizer/me');
          if (!active) return;
          setData(response.data as PortalData);
          if ((response.data as PortalData).profile) setProfileForm({ ...(response.data as PortalData).profile! });
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Gagal memuat data akun.');
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (view !== 'form' || !user || !data?.profile || !form.title.trim() || !['draft', 'revision'].includes(editingStatus)) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    const version = ++draftSaveVersion.current;
    setDraftSaveStatus('dirty');
    draftSaveTimer.current = setTimeout(() => {
      void (async () => {
        setDraftSaveStatus('saving');
        try {
          const posterBase64 = poster ? await asBase64(poster) : undefined;
          const letterBase64 = letter ? await asBase64(letter) : undefined;
          if (version !== draftSaveVersion.current) return;
          const payload = {
            ...form,
            supportingLinks: form.supportingLinksText.split('\\n').map(value => value.trim()).filter(Boolean),
            posterBase64, posterContentType: poster?.type, posterName: poster?.name,
            responsibilityLetterBase64: letterBase64, responsibilityLetterContentType: letter?.type,
            responsibilityLetterName: letter?.name || form.responsibilityLetterName,
            status: 'draft',
          };
          const currentId = draftIdRef.current;
          if (currentId) {
            await api.put('/api/organizer/events/' + encodeURIComponent(currentId), payload);
          } else {
            const response = await api.post('/api/organizer/events', payload);
            const createdId = String(response.data?.id || '');
            if (!createdId) throw new Error('Draf belum mendapat ID penyimpanan.');
            draftIdRef.current = createdId;
            setEventId(createdId);
          }
          if (version === draftSaveVersion.current) setDraftSaveStatus('saved');
        } catch (err) {
          if (version === draftSaveVersion.current) {
            setDraftSaveStatus('error');
            setError(err instanceof Error ? err.message : 'Draf gagal disimpan otomatis.');
          }
        }
      })();
    }, 900);
    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
  }, [view, user, data?.profile?.displayName, form, poster, letter, editingStatus]);

  const publishedCount = data?.events.filter(e => e.status === 'published').length ?? 0;
  const counts = useMemo(() => ({
    all: data?.events.length ?? 0,
    pending: data?.events.filter(e => e.status === 'pending').length ?? 0,
    revision: data?.events.filter(e => e.status === 'revision').length ?? 0,
    published: publishedCount,
    draft: data?.events.filter(e => e.status === 'draft').length ?? 0,
  }), [data, publishedCount]);

  const signIn = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await auth.signIn({ scope: 'openid email profile offline_access' });
      setUser(result.user);
      await refresh();
      setMessage('Akun berhasil terhubung. Lengkapi profil penyelenggara untuk mulai mengajukan acara.');
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setError(code === 'popup_blocked'
        ? 'Popup masuk diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.'
        : code === 'popup_closed'
          ? 'Proses masuk dibatalkan.'
          : e instanceof Error ? e.message : 'Gagal masuk. Coba lagi.');
    } finally { setBusy(false); }
  };

  const signOut = async () => {
    await auth.signOut();
    setUser(null); setData(null); setView('dashboard'); setError(''); setMessage('');
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await api.post('/api/organizer/profile', profileForm);
      setData(prev => prev ? { ...prev, profile: response.data.profile } : prev);
      setProfileSaved(true); setMessage('Profil penyelenggara tersimpan.');
      setView('dashboard');
    } catch (err) { setError(err instanceof Error ? err.message : 'Profil gagal disimpan.'); }
    finally { setBusy(false); }
  };

  const openNewEvent = () => {
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftIdRef.current = null; draftSaveVersion.current += 1;
    setEventId(null); setEditingStatus('draft'); setDraftSaveStatus('idle'); setForm({ ...emptyForm }); setPoster(null); setPosterPreview(''); setLetter(null); setStep(1); setError(''); setMessage(''); setView('form');
  };
  const openEditEvent = (event: EventRecord) => {
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftIdRef.current = event.id; draftSaveVersion.current += 1;
    setEventId(event.id); setEditingStatus(event.status); setDraftSaveStatus('saved');
    setForm({
      title: event.title, category: event.category, description: event.description, culturalRelevance: event.culturalRelevance,
      format: event.format, startDate: event.startDate, endDate: event.endDate, startTime: event.startTime, endTime: event.endTime,
      venue: event.venue, address: event.address, district: event.district, mapLink: event.mapLink,
      latitude: event.latitude == null ? '' : String(event.latitude), longitude: event.longitude == null ? '' : String(event.longitude),
      ticketType: event.ticketType, ticketPrice: event.ticketPrice, ticketLink: event.ticketLink,
      registrationInfo: event.registrationInfo, supportingLinksText: (event.supportingLinks || []).join('\n'),
      responsibilityLetterName: event.responsibilityLetterName || '',
    });
    setPoster(null); setPosterPreview(event.posterUrl || ''); setLetter(null); setStep(1); setError(''); setMessage(''); setView('form');
  };

  const saveEvent = async (status: 'draft' | 'pending') => {
    if (!form.title.trim()) { setError('Nama acara wajib diisi.'); setStep(1); return; }
    if (status === 'pending' && !poster && !posterPreview) { setError('Poster acara wajib diunggah sebelum pengajuan dikirim.'); setStep(4); return; }
    if (status === 'pending' && (!form.startDate || !form.endDate || !form.venue.trim() || !form.culturalRelevance.trim())) {
      setError('Lengkapi tanggal, lokasi, dan relevansi budaya sebelum mengirim.'); return;
    }
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveVersion.current += 1;
    setBusy(true); setError(''); setMessage('');
    try {
      const posterBase64 = poster ? await asBase64(poster) : undefined;
      const letterBase64 = letter ? await asBase64(letter) : undefined;
      const payload = {
        ...form,
        supportingLinks: form.supportingLinksText.split('\n').map(s => s.trim()).filter(Boolean),
        posterBase64, posterContentType: poster?.type, posterName: poster?.name,
        responsibilityLetterBase64: letterBase64, responsibilityLetterContentType: letter?.type, responsibilityLetterName: letter?.name || form.responsibilityLetterName,
        status,
      };
      const currentId = draftIdRef.current || eventId;
      if (currentId) await api.put('/api/organizer/events/' + encodeURIComponent(currentId), payload);
      else {
        const response = await api.post('/api/organizer/events', payload);
        const createdId = String(response.data?.id || '');
        if (createdId) { draftIdRef.current = createdId; setEventId(createdId); }
      }
      setEditingStatus(status);
      setDraftSaveStatus('saved');
      await refresh();
      setView('dashboard');
      setMessage(status === 'draft' ? 'Draf tersimpan.' : 'Pengajuan dikirim. Acara belum tampil di katalog sampai disetujui admin.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Pengajuan gagal disimpan.'); }
    finally { setBusy(false); }
  };

  const loadAdmin = async () => {
    setBusy(true); setError('');
    try {
      const response = await api.get('/api/admin/events');
      setAdminEvents(response.data.events as EventRecord[]);
      setAdminMode(true); setView('admin');
    } catch (err) { setError(err instanceof Error ? err.message : 'Akses admin ditolak atau data gagal dimuat.'); }
    finally { setBusy(false); }
  };

  const loadSuperadmin = async (tab: 'overview' | 'admins' | 'audit' = 'overview') => {
    setBusy(true); setError('');
    try {
      const overview = await api.get('/api/admin/overview');
      setSuperadminStats(overview.data as Record<string, number | string | null>);
      if (tab === 'admins') { const response = await api.get('/api/admin/users'); setManagedAdmins(response.data.admins || []); }
      if (tab === 'audit') { const response = await api.get('/api/admin/audit'); setAuditEntries(response.data.entries || []); }
      setSuperadminTab(tab); setView('superadmin');
    } catch (err) { setError(err instanceof Error ? err.message : 'Dashboard superadmin gagal dimuat.'); }
    finally { setBusy(false); }
  };
  const changeAdminAccess = async (action: 'grant' | 'revoke', email: string) => {
    setBusy(true); setError(''); setMessage('');
    try { await api.post('/api/admin/users', { action, email }); setNewAdminEmail(''); const response = await api.get('/api/admin/users'); setManagedAdmins(response.data.admins || []); setMessage(action === 'grant' ? 'Akses admin berhasil diberikan.' : 'Akses admin berhasil dicabut.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Perubahan akses admin gagal.'); }
    finally { setBusy(false); }
  };

  const requestCancellation = async (event: EventRecord) => {
    const reason = window.prompt('Jelaskan alasan pembatalan acara ini:');
    if (reason === null) return;
    if (reason.trim().length < 10) { setError('Alasan pembatalan minimal 10 karakter.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await api.post('/api/organizer/events/' + encodeURIComponent(event.id) + '/cancel-request', { reason: reason.trim() });
      await refresh();
      setMessage('Permohonan pembatalan dikirim dan menunggu keputusan admin.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Permohonan pembatalan gagal dikirim.'); }
    finally { setBusy(false); }
  };

  const cancellationAction = async (id: string, action: 'approve' | 'reject' | 'direct') => {
    const promptText = action === 'approve' ? 'Catatan persetujuan pembatalan:' : action === 'reject' ? 'Alasan menolak permohonan pembatalan:' : 'Alasan admin membatalkan acara ini:';
    const note = window.prompt(promptText);
    if (note === null) return;
    if (note.trim().length < 5) { setError('Catatan minimal 5 karakter.'); return; }
    if (action === 'direct' && !window.confirm('Batalkan acara ini sekarang? Acara akan hilang dari katalog aktif.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api.post('/api/admin/events/' + encodeURIComponent(id) + '/cancellation', { action, note: note.trim() });
      const response = await api.get('/api/admin/events');
      setAdminEvents(response.data.events as EventRecord[]);
      setMessage(action === 'reject' ? 'Permohonan pembatalan ditolak.' : 'Status acara berhasil diperbarui.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Keputusan pembatalan gagal disimpan.'); }
    finally { setBusy(false); }
  };

  const reviewEvent = async (id: string, action: 'approve' | 'revision' | 'reject') => {
    const note = adminNote[id]?.trim() || '';
    if ((action === 'revision' || action === 'reject') && !note) { setError('Catatan wajib diisi untuk revisi atau penolakan.'); return; }
    setBusy(true); setError('');
    try {
      await api.post('/api/admin/events/' + encodeURIComponent(id) + '/review', { action, note });
      const response = await api.get('/api/admin/events');
      setAdminEvents(response.data.events as EventRecord[]);
      setMessage(action === 'approve' ? 'Acara diterbitkan.' : action === 'revision' ? 'Permintaan revisi dikirim.' : 'Pengajuan ditolak.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Keputusan admin gagal disimpan.'); }
    finally { setBusy(false); }
  };

  const choosePoster = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) { setError('Poster harus berupa JPG, PNG, atau PDF.'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('Ukuran poster maksimal 8 MB.'); return; }
    setPoster(file); setPosterPreview(file.type === 'application/pdf' ? '' : URL.createObjectURL(file)); setError('');
  };
  const chooseLetter = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { setError('Surat tanggung jawab harus berupa PDF, JPG, atau PNG.'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('Ukuran surat maksimal 8 MB.'); return; }
    setLetter(file); setError('');
  };

  const field = (label: string, key: keyof EventForm, type = 'text', required = false, hint = '') => (
    <label className="portal-field">
      <span>{label}{required && <b> *</b>}</span>
      {key === 'category' ? <select required={required} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select>
      : key === 'format' ? <select value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}><option>Luring</option><option>Daring</option><option>Hibrida</option></select>
      : key === 'district' ? <select value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}>{['Kota Yogyakarta','Sleman','Bantul','Kulon Progo','Gunungkidul','Luar DIY'].map(c => <option key={c}>{c}</option>)}</select>
      : key === 'ticketType' ? <select value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value as EventForm['ticketType'] })}><option>Gratis</option><option>Berbayar</option></select>
      : key === 'description' || key === 'culturalRelevance' || key === 'address' || key === 'registrationInfo' ? <textarea required={required} rows={key === 'description' ? 4 : 3} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={hint} />
      : <input required={required} type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={hint} />}
    </label>
  );

  return (
    <div className="portal-backdrop">
      <section className="organizer-portal" role="dialog" aria-modal="true" aria-label="Ruang penyelenggara Eventara Budaya">
        <header className="portal-topbar">
          <a className="brand" href="#top" onClick={e => { e.preventDefault(); onClose(); }}>
            <img className="brand-logo" src="/resources/eventara-logo.png" alt="" />
            <span>Eventara <b>Budaya</b></span>
          </a>
          <div className="portal-top-actions">
            {user && <span className="portal-user"><UserRound size={15} /> {user.name || user.email}</span>}
            {user && <button className="portal-quiet-button" onClick={signOut}><LogOut size={16} /> Keluar</button>}
            <button className="portal-close" onClick={onClose} aria-label="Tutup ruang penyelenggara"><X /></button>
          </div>
        </header>
        {!user ? (
          <div className="portal-auth">
            <div className="portal-auth-mark"><Building2 size={28} /></div>
            <p className="portal-eyebrow">RUANG PENYELENGGARA</p>
            <h1>Acara budaya layak ditemukan.</h1>
            <p>Masuk atau buat akun untuk mengajukan acara, mengelola banyak kegiatan, dan memantau proses verifikasi.</p>
            <button className="portal-primary" onClick={signIn} disabled={busy}>{busy ? 'Menghubungkan akun…' : 'Masuk / Daftar dengan email'} <ArrowRight size={17} /></button>
            <p className="portal-muted">Autentikasi aman melalui AppDeploy. Email digunakan untuk masuk; nomor WhatsApp tidak wajib saat registrasi.</p>
            <div className="portal-auth-note"><ShieldCheck size={18} /> Acara baru ditinjau admin sebelum diterbitkan.</div>
          </div>
        ) : ((!data?.profile && view !== 'admin' && view !== 'superadmin') || view === 'profile') ? (
          <div className="portal-main portal-narrow">
            {(data?.role === 'admin' || data?.role === 'superadmin') && <button className="portal-secondary" onClick={() => data.role === 'superadmin' ? loadSuperadmin() : loadAdmin()} disabled={busy}><ShieldCheck size={16} /> {data.role === 'superadmin' ? 'Buka dashboard superadmin' : 'Buka dashboard admin'}</button>}
            <button className="portal-back" onClick={() => setView('dashboard')}><ArrowLeft size={16} /> Kembali ke dashboard</button>
            <p className="portal-eyebrow">IDENTITAS PENYELENGGARA</p>
            <p className="portal-muted">Status akses akun: <b>{data?.role || 'belum terbaca'}</b></p>
            <h1>{data?.profile ? 'Ubah profil penyelenggara' : 'Buat profil penyelenggara'}</h1>
            <p className="portal-muted">Satu akun memiliki satu identitas penyelenggara. Individu maupun organisasi boleh mendaftar.</p>
            <form className="portal-form" onSubmit={saveProfile}>
              <label className="portal-field"><span>Jenis penyelenggara *</span><select value={profileForm.type} onChange={e => setProfileForm({ ...profileForm, type: e.target.value as OrganizerProfile['type'] })}><option value="individual">Individu</option><option value="organization">Organisasi / komunitas / sanggar</option></select></label>
              <label className="portal-field"><span>Nama tampilan penyelenggara *</span><input required value={profileForm.displayName} onChange={e => setProfileForm({ ...profileForm, displayName: e.target.value })} placeholder="Nama pribadi atau nama komunitas" /></label>
              <label className="portal-field"><span>Deskripsi singkat</span><textarea rows={4} value={profileForm.description} onChange={e => setProfileForm({ ...profileForm, description: e.target.value })} placeholder="Ceritakan kegiatan dan fokus budaya penyelenggara." /></label>
              <label className="portal-field"><span>Kota / wilayah</span><input value={profileForm.city} onChange={e => setProfileForm({ ...profileForm, city: e.target.value })} placeholder="Yogyakarta" /></label>
              <div className="portal-form-grid">
                <label className="portal-field"><span>Situs web (opsional)</span><input type="url" value={profileForm.website || ''} onChange={e => setProfileForm({ ...profileForm, website: e.target.value })} placeholder="https://" /></label>
                <label className="portal-field"><span>Media sosial (opsional)</span><input type="url" value={profileForm.socialLink || ''} onChange={e => setProfileForm({ ...profileForm, socialLink: e.target.value })} placeholder="https://instagram.com/..." /></label>
              </div>
              <button className="portal-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan profil'} <ArrowRight size={17} /></button>
            </form>
          </div>
        ) : view === 'superadmin' ? (
          <div className="portal-main">
            <button className="portal-back" onClick={() => setView('dashboard')}><ArrowLeft size={16} /> Kembali</button>
            <div className="portal-page-heading"><div><p className="portal-eyebrow">PUSAT KENDALI EVENTARA</p><h1>Dashboard Superadmin</h1><p className="portal-muted">Kelola akses pengelola dan pantau aktivitas platform.</p></div><span className="portal-role-chip"><ShieldCheck size={15}/> SUPERADMIN</span></div>
            <nav className="portal-admin-tabs"><button className={superadminTab === 'overview' ? 'active' : ''} onClick={() => loadSuperadmin('overview')}><LayoutDashboard size={16}/> Ringkasan</button><button className={superadminTab === 'admins' ? 'active' : ''} onClick={() => loadSuperadmin('admins')}><Users size={16}/> Manajemen admin</button><button className={superadminTab === 'audit' ? 'active' : ''} onClick={() => loadSuperadmin('audit')}><Activity size={16}/> Audit log</button></nav>
            {superadminTab === 'overview' && <><div className="portal-stat-grid portal-super-stat"><div><CalendarDays/><strong>{superadminStats.events ?? '—'}</strong><span>Total pengajuan</span></div><div><Clock3/><strong>{superadminStats.pending ?? '—'}</strong><span>Menunggu verifikasi</span></div><div><CheckCircle2/><strong>{superadminStats.published ?? '—'}</strong><span>Acara diterbitkan</span></div><div><Users/><strong>{superadminStats.admins ?? '—'}</strong><span>Admin aktif</span></div></div><div className="portal-super-actions"><button className="portal-super-action" onClick={() => loadSuperadmin('admins')}><UserPlus/><span><b>Kelola akun admin</b><small>Berikan atau cabut akses pengelola</small></span><ChevronRight/></button><button className="portal-super-action" onClick={() => loadSuperadmin('audit')}><History/><span><b>Lihat audit log</b><small>Periksa aktivitas administratif</small></span><ChevronRight/></button><button className="portal-super-action" onClick={loadAdmin}><ShieldCheck/><span><b>Verifikasi pengajuan</b><small>Kelola acara yang masuk</small></span><ChevronRight/></button></div></>}
            {superadminTab === 'admins' && <section className="portal-super-panel"><h2>Manajemen akun admin</h2><p className="portal-muted">Tambahkan email untuk memberikan akses admin biasa. Admin tidak memperoleh kewenangan superadmin.</p><form className="portal-admin-add" onSubmit={e => { e.preventDefault(); if (newAdminEmail.trim()) void changeAdminAccess('grant', newAdminEmail.trim()); }}><input type="email" required value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="email@contoh.com"/><button className="portal-primary" disabled={busy}><UserPlus size={16}/> Tambahkan admin</button></form><div className="portal-managed-list">{managedAdmins.length ? managedAdmins.map(item => <div className="portal-managed-row" key={item.email}><span className="portal-admin-avatar"><UserRound size={17}/></span><span className="portal-managed-email"><b>{item.email}</b><small>Admin · Aktif</small></span><button className="portal-danger portal-revoke" disabled={busy} onClick={() => { if (window.confirm('Cabut akses admin untuk ' + item.email + '?')) void changeAdminAccess('revoke', item.email); }}><UserMinus size={15}/> Cabut akses</button></div>) : <div className="portal-empty"><Users size={24}/><h3>Belum ada admin tambahan</h3><p>Akun superadmin tidak ditampilkan dalam daftar admin biasa.</p></div>}</div></section>}
            {superadminTab === 'audit' && <section className="portal-super-panel"><h2>Riwayat aktivitas</h2><p className="portal-muted">Catatan tindakan administratif yang tercatat di backend.</p>{auditEntries.length ? <div className="portal-audit-list">{auditEntries.map((entry, i) => <article className="portal-audit-row" key={i}><span className="portal-audit-icon"><Activity size={17}/></span><div><b>{entry.action.replaceAll('_',' ')}</b><p>{entry.actorEmail} {entry.target ? '· ' + entry.target : ''}</p>{entry.details && <small>{entry.details}</small>}</div><time>{new Date(entry.createdAt).toLocaleString('id-ID')}</time></article>)}</div> : <div className="portal-empty"><History size={24}/><h3>Belum ada aktivitas tercatat</h3></div>}</section>}
            {error && <div className="portal-alert error">{error}</div>}{message && <div className="portal-alert success">{message}</div>}
          </div>
        ) : view === 'form' ? (
          <div className="portal-main">
            <button className="portal-back" onClick={() => setView('dashboard')}><ArrowLeft size={16} /> Kembali ke acara saya</button>
            <div className="portal-page-heading"><div><p className="portal-eyebrow">PENGAJUAN ACARA</p><h1>{eventId ? 'Edit acara' : 'Ajukan acara baru'}</h1><p className="portal-muted">Draf tersimpan otomatis saat kamu mengisi. Poster wajib sebelum dikirim untuk verifikasi.</p><p className="portal-muted portal-autosave-status" role="status">{draftSaveStatus === 'saving' ? 'Menyimpan draf…' : draftSaveStatus === 'saved' ? '✓ Draf tersimpan' : draftSaveStatus === 'error' ? 'Penyimpanan otomatis gagal. Periksa koneksi lalu lanjutkan mengisi.' : draftSaveStatus === 'dirty' ? 'Perubahan belum tersimpan…' : 'Penyimpanan otomatis aktif setelah nama acara diisi.'}</p></div><span className="portal-step-count">Langkah {step} dari 4</span></div>
            <div className="portal-stepper">{['Informasi acara','Waktu & lokasi','Tiket & penyelenggara','Pratinjau'].map((label, i) => <button key={label} className={step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''} onClick={() => setStep(i + 1)}><span>{step > i + 1 ? '✓' : i + 1}</span>{label}</button>)}</div>
            {step === 1 && <div className="portal-form portal-card">
              <h2>Informasi acara</h2>
              {field('Nama acara', 'title', 'text', true, 'Nama acara yang akan ditampilkan')}
              {field('Kategori', 'category', 'text', true)}
              {field('Deskripsi acara', 'description', 'text', true, 'Jelaskan kegiatan, pengisi acara, atau rangkaian kegiatan.')}
              {field('Relevansi budaya', 'culturalRelevance', 'text', true, 'Jelaskan secara singkat kaitan acara dengan seni, tradisi, kriya, kuliner, sejarah, sastra, atau kegiatan budaya lain.')}
              <label className="portal-field"><span>Tautan informasi / pengumuman resmi</span><textarea rows={2} value={form.supportingLinksText} onChange={e => setForm({ ...form, supportingLinksText: e.target.value })} placeholder="Satu tautan per baris. Situs, media sosial penyelenggara atau mitra." /></label>
              <div className="portal-note"><AlertCircle size={17} /> Tautan resmi atau surat pernyataan tanggung jawab dapat diminta admin sesuai kebutuhan. Dokumen izin bukan persyaratan umum Eventara.</div>
            </div>}
            {step === 2 && <div className="portal-form portal-card">
              <h2>Waktu dan lokasi</h2>
              <label className="portal-field"><span>Format acara *</span><select value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}><option>Luring</option><option>Daring</option><option>Hibrida</option></select></label>
              <div className="portal-form-grid">{field('Tanggal mulai', 'startDate', 'date', true)}{field('Tanggal selesai', 'endDate', 'date', true)}{field('Jam mulai', 'startTime', 'time')}{field('Jam selesai', 'endTime', 'time')}</div>
              {field('Nama tempat / platform', 'venue', 'text', true, 'Nama gedung, ruang, atau platform daring')}
              {field('Alamat lengkap', 'address', 'text', false, 'Alamat acara')}
              {field('Kota / kabupaten', 'district', 'text', true)}
              {field('Tautan peta', 'mapLink', 'url', false, 'https://maps.google.com/...')}
              <div className="portal-form-grid">
                {field('Latitude lokasi (opsional)', 'latitude', 'number', false, 'Contoh: -7.8014')}
                {field('Longitude lokasi (opsional)', 'longitude', 'number', false, 'Contoh: 110.3642')}
              </div>
              <div className="portal-note"><MapPin size={17} /> Koordinat dipakai untuk menghitung jarak acara dari lokasi pengunjung. Ambil angka latitude dan longitude dari Google Maps. Tanpa koordinat, acara tetap tampil di katalog tetapi tidak masuk hasil pencarian terdekat.</div>
            </div>}
            {step === 3 && <div className="portal-form portal-card">
              <h2>Tiket dan informasi penyelenggara</h2>
              <label className="portal-field"><span>Jenis tiket *</span><select value={form.ticketType} onChange={e => setForm({ ...form, ticketType: e.target.value as EventForm['ticketType'] })}><option>Gratis</option><option>Berbayar</option></select></label>
              {form.ticketType === 'Berbayar' && <div className="portal-form-grid">{field('Rentang / harga tiket', 'ticketPrice', 'text', true, 'Contoh: Rp25.000–Rp50.000')}{field('Tautan pembelian tiket', 'ticketLink', 'url', false, 'https://')}</div>}
              {field('Syarat pendaftaran (opsional)', 'registrationInfo', 'text', false, 'Misalnya pendaftaran daring atau batas usia.')}
              <div className="portal-note"><Building2 size={17} /> Profil penyelenggara: <b>{data.profile.displayName}</b>. Semua acara dari akun ini berada di bawah satu identitas yang sama.</div>
            </div>}
            {step === 4 && <div className="portal-form portal-card">
              <h2>Pratinjau dan kelengkapan</h2>
              <div className="portal-preview-card">
                {posterPreview && <img src={posterPreview} alt="Pratinjau poster acara" />}
                <div><span className="portal-category-chip">{form.category}</span><h3>{form.title || 'Nama acara belum diisi'}</h3><p><CalendarDays size={15} /> {dateLabel(form.startDate)}{form.endDate && form.endDate !== form.startDate ? ' – ' + dateLabel(form.endDate) : ''}</p><p><MapPin size={15} /> {form.venue || 'Tempat belum diisi'} · {form.district}</p><p>{form.description || 'Deskripsi acara akan tampil di sini.'}</p></div>
              </div>
              <label className="portal-upload"><UploadCloud size={23} /><span><b>Poster acara *</b><small>JPG, PNG, atau PDF. Maksimal 8 MB.</small><input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={choosePoster} /></span>{poster || posterPreview ? <CheckCircle2 size={19} /> : <ImagePlus size={19} />}</label>
              {poster?.name && <p className="portal-file-name">{poster.name}</p>}
              <label className="portal-upload"><FileText size={23} /><span><b>Surat pernyataan tanggung jawab (opsional)</b><small>Surat dari ketua, koordinator, sekretaris, atau penanggung jawab acara. PDF/JPG/PNG, maksimal 8 MB.</small><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={chooseLetter} /></span>{letter ? <CheckCircle2 size={19} /> : <Plus size={19} />}</label>
              {letter && <p className="portal-file-name">{letter.name}</p>}
              <label className="portal-consent"><input type="checkbox" id="portal-confirm" /> Saya menyatakan informasi yang diberikan benar dan memiliki hak untuk menggunakan poster serta materi yang diunggah.</label>
              <div className="portal-note"><ShieldCheck size={17} /> Pengajuan pertama diperiksa admin sebelum terbit. Bukti tambahan dapat diminta sesuai kebutuhan, tanpa mewajibkan dokumen izin sebagai syarat umum.</div>
            </div>}
            {error && <div className="portal-alert error">{error}</div>}
            {message && <div className="portal-alert success">{message}</div>}
            <div className="portal-form-actions">
              <button className="portal-secondary" onClick={() => saveEvent('draft')} disabled={busy}><Save size={16} /> Simpan draf sekarang</button>
              <div>{step > 1 && <button className="portal-secondary" onClick={() => setStep(step - 1)}>Sebelumnya</button>} {step < 4 ? <button className="portal-primary" onClick={() => { setError(''); setStep(step + 1); }}>Lanjut <ArrowRight size={16} /></button> : <button className="portal-primary" disabled={busy} onClick={() => { const c = document.getElementById('portal-confirm') as HTMLInputElement | null; if (!c?.checked) { setError('Konfirmasi kebenaran informasi wajib dicentang.'); return; } void saveEvent('pending'); }}>{busy ? 'Mengirim…' : 'Kirim untuk verifikasi'} <ArrowRight size={16} /></button>}</div>
            </div>
          </div>
        ) : view === 'admin' ? (
          <div className="portal-main">
            <button className="portal-back" onClick={() => { setView('dashboard'); setAdminMode(false); }}><ArrowLeft size={16} /> Dashboard penyelenggara</button>
            <p className="portal-eyebrow">PENGELOLAAN EVENTARA</p><h1>Verifikasi pengajuan acara</h1>
            <div className="portal-toolbar"><label className="portal-field"><span>Filter status</span><select value={adminFilter} onChange={e => setAdminFilter(e.target.value)}><option value="pending">Menunggu verifikasi</option><option value="revision">Perlu revisi</option><option value="published">Diterbitkan</option><option value="rejected">Ditolak</option><option value="cancellation_requested">Menunggu pembatalan</option><option value="cancelled">Dibatalkan</option><option value="all">Semua status</option></select></label><button className="portal-secondary" onClick={loadAdmin} disabled={busy}><History size={16} /> Muat ulang</button></div>
            {error && <div className="portal-alert error" role="alert">{error}</div>}
            {message && <div className="portal-alert success" role="status">{message}</div>}
            {adminEvents.filter(e => adminFilter === 'all' || e.status === adminFilter).map(event => <article className="portal-admin-event" key={event.id}><div className="portal-admin-event-head"><div><span className={statusClass(event.status)}>{statusLabel[event.status]}</span><h3>{event.title}</h3><p>{event.category} · {dateLabel(event.startDate)} · {event.district}</p></div>{event.posterUrl && <a href={event.posterUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Poster</a>}</div><p>{event.description}</p><p><b>Relevansi budaya:</b> {event.culturalRelevance}</p><p><b>Tempat:</b> {event.venue} · {event.address}</p>{event.supportingLinks?.length > 0 && <p><b>Tautan bukti:</b> {event.supportingLinks.map(link => <a key={link} href={link} target="_blank" rel="noreferrer">{link} <ExternalLink size={12} /></a>)}</p>}{event.adminNote && <div className="portal-note"><AlertCircle size={16} /> Catatan sebelumnya: {event.adminNote}</div>}<label className="portal-field"><span>Catatan admin (wajib untuk revisi/penolakan)</span><textarea rows={2} value={adminNote[event.id] || ''} onChange={e => setAdminNote({ ...adminNote, [event.id]: e.target.value })} placeholder="Jelaskan alasan revisi atau penolakan dengan spesifik." /></label><div className="portal-admin-actions">{event.status === 'cancellation_requested' ? <><button className="portal-secondary" disabled={busy} onClick={() => cancellationAction(event.id, 'reject')}>Tolak pembatalan</button><button className="portal-danger" disabled={busy} onClick={() => cancellationAction(event.id, 'approve')}>Setujui pembatalan</button></> : <>{event.status === 'published' && <button className="portal-danger" disabled={busy} onClick={() => cancellationAction(event.id, 'direct')}>Batalkan acara</button>}{['pending','revision'].includes(event.status) && <><button className="portal-secondary" disabled={busy} onClick={() => reviewEvent(event.id, 'revision')}>Minta revisi</button><button className="portal-danger" disabled={busy} onClick={() => reviewEvent(event.id, 'reject')}>Tolak</button><button className="portal-primary" disabled={busy} onClick={() => reviewEvent(event.id, 'approve')}><CheckCircle2 size={16} /> Setujui & terbitkan</button></>}</>}</div><details><summary>Riwayat keputusan</summary>{event.history?.map((h, i) => <p key={i} className="portal-history-item">{new Date(h.at).toLocaleString('id-ID')} · {h.action}{h.note ? ': ' + h.note : ''}</p>)}</details></article>)}
            {adminEvents.filter(e => adminFilter === 'all' || e.status === adminFilter).length === 0 && <div className="portal-empty"><CheckCircle2 size={25} /><h3>Tidak ada pengajuan pada status ini</h3></div>}
          </div>
        ) : (
          <div className="portal-main">
            <div className="portal-page-heading"><div><p className="portal-eyebrow">RUANG PENYELENGGARA</p><h1>{data.profile.displayName}</h1><p className="portal-muted">{data.profile.type === 'individual' ? 'Penyelenggara individu' : 'Organisasi / komunitas'} · {data.profile.city || 'Wilayah belum diisi'}</p></div><button className="portal-secondary" onClick={() => setView('profile')}><Settings size={16} /> Profil</button></div>
            {publishedCount > 0 && <div className="portal-public-note"><ShieldCheck size={18} /><span><b>Profil publik aktif</b><small>Profil tampil karena sudah memiliki acara yang disetujui.</small></span></div>}
            <div className="portal-stat-grid"><div><CalendarDays /><strong>{counts.all}</strong><span>Total acara</span></div><div><Clock3 /><strong>{counts.pending}</strong><span>Menunggu verifikasi</span></div><div><FileText /><strong>{counts.revision}</strong><span>Perlu revisi</span></div><div><CheckCircle2 /><strong>{counts.published}</strong><span>Diterbitkan</span></div></div>
            <div className="portal-section-head"><div><h2>Acara saya</h2><p>Semua kegiatan dalam satu identitas penyelenggara.</p></div><button className="portal-primary" onClick={openNewEvent}><Plus size={17} /> Ajukan acara</button></div>
            {data.events.length ? <div className="portal-event-list">{data.events.map(event => <article className="portal-event-row" key={event.id}><div className="portal-event-icon"><CalendarDays size={22} /></div><div className="portal-event-main"><span className={statusClass(event.status)}>{statusLabel[event.status]}</span><h3>{event.title}</h3><p>{event.category} · {dateLabel(event.startDate)} · {event.district}</p>{event.status === 'revision' && event.adminNote && <div className="portal-revision-note"><AlertCircle size={15} /><span><b>Catatan admin:</b> {event.adminNote}</span></div>}{event.status === 'cancellation_requested' && <div className="portal-revision-note"><AlertCircle size={15} /><span><b>Alasan pembatalan:</b> {String((event as EventRecord & { cancellationReason?: string }).cancellationReason || 'Menunggu keputusan admin.')}</span></div>}{event.status === 'published' && <button className="portal-danger" disabled={busy} onClick={() => requestCancellation(event)}>Ajukan pembatalan</button>}{event.status === 'published' && event.updatedAt && Date.now() - new Date(event.updatedAt).getTime() < 7 * 86400000 && <span className="portal-updated">Diperbarui</span>}</div><button className="portal-row-action" onClick={() => openEditEvent(event)}>{event.status === 'published' ? 'Edit acara' : event.status === 'pending' ? 'Lihat / edit' : 'Kelola'} <ChevronRight size={16} /></button></article>)}</div> : <div className="portal-empty"><CalendarDays size={27} /><h3>Belum ada acara</h3><p>Buat pengajuan pertama. Setelah disetujui, acara akan tampil di katalog dan profil publik.</p><button className="portal-primary" onClick={openNewEvent}><Plus size={17} /> Ajukan acara pertama</button></div>}
            {error && <div className="portal-alert error">{error}</div>}{message && <div className="portal-alert success">{message}</div>}
            <div className="portal-dashboard-bottom"><button className="portal-secondary" onClick={() => setView('profile')}><UserRound size={16} /> Profil penyelenggara</button><button className="portal-secondary" onClick={loadAdmin}><ShieldCheck size={16} /> Dashboard admin</button></div>
            <p className="portal-muted portal-small">Akun: {data.user.email || user.email}. Nomor WhatsApp tidak diperlukan untuk registrasi.</p>
          </div>
        )}
        {error && view !== 'form' && <div className="portal-global-alert">{error}</div>}
        <footer className="portal-footer"><span>EVENTARA BUDAYA</span><span>Ruang untuk merayakan budaya.</span></footer>
      </section>
    </div>
  );
}
