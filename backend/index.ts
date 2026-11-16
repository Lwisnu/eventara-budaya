import { router, json, error, requireAuth, db, storage, secrets } from '@appdeploy/sdk';

type EventInput = {
  title?: string; category?: string; description?: string; culturalRelevance?: string;
  supportingLinks?: string[]; format?: string; startDate?: string; endDate?: string;
  startTime?: string; endTime?: string; venue?: string; address?: string; district?: string;
  mapLink?: string; latitude?: string | number; longitude?: string | number; ticketType?: string; ticketPrice?: string; ticketLink?: string;
  registrationInfo?: string; status?: string; posterBase64?: string; posterContentType?: string;
  posterName?: string; responsibilityLetterBase64?: string; responsibilityLetterContentType?: string;
  responsibilityLetterName?: string;
};
const now = () => new Date().toISOString();
const jakartaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
async function recordsWithPosterUrls<T extends { posterPath?: string; posterUrl?: string }>(items: T[]) {
  const paths = items.map(item => item.posterPath).filter((path): path is string => Boolean(path));
  const urls = paths.length ? await storage.url(paths) : [];
  const byPath = new Map(urls.map(item => [item.path, item.url]));
  return items.map(item => ({ ...item, posterUrl: item.posterPath ? byPath.get(item.posterPath) || '' : item.posterUrl || '' }));
}
async function getAllEvents() {
  const result = await db.list<Record<string, unknown>>('event_submissions', { limit: 100 });
  return result.items;
}

// Resolve both current chosen IDs and legacy application IDs without deleting or recreating records.
async function findEventRecord(id: string) {
  const [direct] = await db.get<Record<string, unknown>>('event_submissions', [id], { consistent: true });
  if (direct) return { record: direct, storageId: id };

  const listed = await db.list<Record<string, unknown>>('event_submissions', { limit: 100 });
  const match = listed.items.find(item =>
    String(item.id || '') === id || String(item.eventId || '') === id
  );
  if (!match) return null;
  return { record: match, storageId: String(match.id || id) };
}
type UserRole = 'superadmin' | 'admin' | 'organizer' | 'visitor';
type AccessContext = { user?: { userId?: string; email?: string } };
const normalizeEmail = (value: string) => value.trim().toLowerCase();
function adminRecordId(email: string) {
  let hash = 2166136261;
  for (const char of normalizeEmail(email)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return 'adm_' + (hash >>> 0).toString(16);
}
async function configuredEmails(secretName: string) {
  const names = await secrets.listSecretNames();
  if (!names.includes(secretName)) return [];
  try {
    return (await secrets.readSecret(secretName)).split(/[;,\r\n]+/).map(normalizeEmail).filter(Boolean);
  } catch {
    return [];
  }
}
async function getUserRole(email?: string): Promise<UserRole> {
  if (!email) return 'visitor';
  const normalized = normalizeEmail(email);
  if ((await configuredEmails('EVENTARA_SUPERADMIN_EMAILS')).includes(normalized)) return 'superadmin';
  const [managedAdmin] = await db.get<{ email: string; active: boolean }>('eventara_admins', [adminRecordId(normalized)], { consistent: true });
  if (managedAdmin?.active && normalizeEmail(managedAdmin.email) === normalized) return 'admin';
  if ((await configuredEmails('EVENTARA_ADMIN_EMAILS')).includes(normalized)) return 'admin';
  return 'organizer';
}
async function adminGuard(ctx: AccessContext, minimum: 'admin' | 'superadmin' = 'admin') {
  if (!ctx.user?.email) return error('Akun tidak memiliki email terverifikasi.', 403);
  const role = await getUserRole(ctx.user.email);
  if (minimum === 'superadmin' && role !== 'superadmin') {
    const names = await secrets.listSecretNames();
    if (!names.includes('EVENTARA_SUPERADMIN_EMAILS')) return error('Superadmin belum dikonfigurasi. Pemilik aplikasi perlu mengatur EVENTARA_SUPERADMIN_EMAILS melalui formulir rahasia AppDeploy.', 503);
    return error('Akses khusus superadmin.', 403);
  }
  if (role !== 'admin' && role !== 'superadmin') return error('Akses khusus admin.', 403);
  return null;
}
async function writeAdminAudit(ctx: AccessContext, action: string, target?: string, details?: string) {
  const actorEmail = normalizeEmail(ctx.user?.email || '');
  const id = 'aud_' + crypto.randomUUID().replace(/-/g, '');
  const [saved] = await db.add('eventara_admin_audit', [{
    id, actorUserId: ctx.user?.userId || '', actorEmail, action,
    target: String(target || '').slice(0, 180), details: String(details || '').slice(0, 500),
    createdAt: now(),
  }]);
  if (!saved) throw new Error('Audit log gagal disimpan.');
}
function cleanEvent(input: EventInput) {
  return {
    title: String(input.title || '').trim(),
    category: String(input.category || '').trim(),
    description: String(input.description || '').trim(),
    culturalRelevance: String(input.culturalRelevance || '').trim(),
    supportingLinks: Array.isArray(input.supportingLinks) ? input.supportingLinks.filter((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value.trim())).map(value => value.trim()).slice(0, 12) : [],
    format: String(input.format || 'Luring'),
    startDate: String(input.startDate || ''),
    endDate: String(input.endDate || ''),
    startTime: String(input.startTime || ''),
    endTime: String(input.endTime || ''),
    venue: String(input.venue || '').trim(),
    address: String(input.address || '').trim(),
    district: String(input.district || '').trim(),
    mapLink: /^https?:\/\//i.test(String(input.mapLink || '')) ? String(input.mapLink) : '',
    latitude: Number.isFinite(Number(input.latitude)) && input.latitude !== '' && Number(input.latitude) >= -90 && Number(input.latitude) <= 90 ? Number(input.latitude) : null,
    longitude: Number.isFinite(Number(input.longitude)) && input.longitude !== '' && Number(input.longitude) >= -180 && Number(input.longitude) <= 180 ? Number(input.longitude) : null,
    ticketType: input.ticketType === 'Berbayar' ? 'Berbayar' : 'Gratis',
    ticketPrice: String(input.ticketPrice || '').trim(),
    ticketLink: /^https?:\/\//i.test(String(input.ticketLink || '')) ? String(input.ticketLink) : '',
    registrationInfo: String(input.registrationInfo || '').trim(),
    responsibilityLetterName: String(input.responsibilityLetterName || '').slice(0, 200),
  };
}
export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],

  'GET /api/organizer/me': [
    requireAuth(),
    async (ctx) => {
      const user = ctx.user!;
      const [profile] = await db.get<Record<string, unknown>>('organizer_profiles', [user.userId], { consistent: true });
      const all = await getAllEvents();
      const owned = all.filter(item => item.ownerId === user.userId);
      const visible = owned.map(item => item.cancellationRequested === true ? { ...item, status: 'cancellation_requested' } : item);
      const events = await recordsWithPosterUrls(visible as Array<Record<string, unknown> & { posterPath?: string; posterUrl?: string }>);
      return json({ user: { userId: user.userId, email: user.email, name: user.name }, role: await getUserRole(user.email), profile: profile || null, events });
    },
  ],

  'POST /api/organizer/profile': [
    requireAuth(),
    async (ctx) => {
      const user = ctx.user!;
      const body = (ctx.body || {}) as { displayName?: string; type?: string; description?: string; city?: string; website?: string; socialLink?: string };
      const displayName = String(body.displayName || '').trim();
      if (!displayName) return error('Nama tampilan penyelenggara wajib diisi.', 400);
      const record = {
        displayName: displayName.slice(0, 120),
        type: body.type === 'organization' ? 'organization' : 'individual',
        description: String(body.description || '').trim().slice(0, 1200),
        city: String(body.city || '').trim().slice(0, 120),
        website: /^https?:\/\//i.test(String(body.website || '')) ? String(body.website) : '',
        socialLink: /^https?:\/\//i.test(String(body.socialLink || '')) ? String(body.socialLink) : '',
        ownerId: user.userId,
        updatedAt: now(),
      };
      const [existing] = await db.get<Record<string, unknown>>('organizer_profiles', [user.userId], { consistent: true });
      if (existing) {
        const [ok] = await db.update('organizer_profiles', [{ id: user.userId, record }]);
        if (!ok) return error('Profil gagal diperbarui.', 500);
      } else {
        const [id] = await db.tx.add('organizer_profiles', [{ ...record, id: user.userId }]);
        if (!id) {
          const [after] = await db.get<Record<string, unknown>>('organizer_profiles', [user.userId], { consistent: true });
          if (!after) return error('Profil gagal dibuat. Coba lagi.', 500);
        }
      }
      return json({ profile: record });
    },
  ],

  'POST /api/organizer/events': [
    requireAuth(),
    async (ctx) => {
      const user = ctx.user!;
      const input = (ctx.body || {}) as EventInput;
      const [profile] = await db.get<Record<string, unknown>>('organizer_profiles', [user.userId], { consistent: true });
      if (!profile) return error('Lengkapi profil penyelenggara sebelum mengajukan acara.', 400);
      const fields = cleanEvent(input);
      if (!fields.title) return error('Nama acara wajib diisi.', 400);
      if (input.status === 'pending' && (!input.posterBase64 || !fields.startDate || !fields.endDate || !fields.venue || !fields.culturalRelevance)) return error('Poster, tanggal, lokasi, dan relevansi budaya wajib dilengkapi untuk pengajuan.', 400);
      const id = 'evt_' + crypto.randomUUID().replace(/-/g, '');
      let posterPath = '';
      if (input.posterBase64 && input.posterContentType && ['image/jpeg', 'image/png', 'application/pdf'].includes(input.posterContentType)) {
        posterPath = 'event-posters/' + safe(user.userId) + '/' + id + '/' + safe(input.posterName || 'poster');
        const [ok] = await storage.write([{ path: posterPath, content: input.posterBase64, contentType: input.posterContentType }]);
        if (!ok) return error('Poster gagal diunggah.', 500);
      }
      let responsibilityLetterPath = '';
      if (input.responsibilityLetterBase64 && input.responsibilityLetterContentType && ['application/pdf', 'image/jpeg', 'image/png'].includes(input.responsibilityLetterContentType)) {
        responsibilityLetterPath = 'event-evidence/' + safe(user.userId) + '/' + id + '/' + safe(input.responsibilityLetterName || 'surat');
        const [ok] = await storage.write([{ path: responsibilityLetterPath, content: input.responsibilityLetterBase64, contentType: input.responsibilityLetterContentType }]);
        if (!ok) return error('Surat pendukung gagal diunggah.', 500);
      }
      const timestamp = now();
      const status = input.status === 'pending' ? 'pending' : 'draft';
      const record = {
        ...fields, id, ownerId: user.userId, organizerName: String(profile.displayName || ''),
        posterPath, posterName: String(input.posterName || ''), posterContentType: String(input.posterContentType || ''), responsibilityLetterPath,
        status, adminNote: '', createdAt: timestamp, updatedAt: timestamp, publishedAt: '',
        history: [{ at: timestamp, action: status === 'pending' ? 'Pengajuan dikirim' : 'Draf dibuat' }],
      };
      const [savedId] = await db.tx.add('event_submissions', [{ ...record, eventId: id }]);
      if (!savedId) return error('Pengajuan gagal disimpan.', 500);
      return json({ id, status });
    },
  ],

  'PUT /api/organizer/events/:id': [
    requireAuth(),
    async (ctx) => {
      const user = ctx.user!;
      const id = ctx.params.id;
      const input = (ctx.body || {}) as EventInput;
      const found = await findEventRecord(id);
      const existing = found?.record;
      if (!existing || existing.ownerId !== user.userId) return error('Acara tidak ditemukan pada akun ini.', 404);
      const [profile] = await db.get<Record<string, unknown>>('organizer_profiles', [user.userId], { consistent: true });
      if (!profile) return error('Profil penyelenggara tidak ditemukan.', 400);
      const fields = cleanEvent(input);
      if (!fields.title) return error('Nama acara wajib diisi.', 400);
      if (input.status === 'pending' && (!fields.startDate || !fields.endDate || !fields.venue || !fields.culturalRelevance || (!(input.posterBase64) && !existing.posterPath))) return error('Poster, tanggal, lokasi, dan relevansi budaya wajib dilengkapi untuk pengajuan.', 400);
      let posterPath = String(existing.posterPath || '');
      if (input.posterBase64 && input.posterContentType && ['image/jpeg', 'image/png', 'application/pdf'].includes(input.posterContentType)) {
        posterPath = 'event-posters/' + safe(user.userId) + '/' + id + '/' + safe(input.posterName || 'poster');
        const [ok] = await storage.write([{ path: posterPath, content: input.posterBase64, contentType: input.posterContentType }]);
        if (!ok) return error('Poster gagal diunggah.', 500);
      }
      let responsibilityLetterPath = String(existing.responsibilityLetterPath || '');
      if (input.responsibilityLetterBase64 && input.responsibilityLetterContentType && ['application/pdf', 'image/jpeg', 'image/png'].includes(input.responsibilityLetterContentType)) {
        responsibilityLetterPath = 'event-evidence/' + safe(user.userId) + '/' + id + '/' + safe(input.responsibilityLetterName || 'surat');
        const [ok] = await storage.write([{ path: responsibilityLetterPath, content: input.responsibilityLetterBase64, contentType: input.responsibilityLetterContentType }]);
        if (!ok) return error('Surat pendukung gagal diunggah.', 500);
      }
      const timestamp = now();
      const status = existing.status === 'published' ? 'published' : input.status === 'pending' ? 'pending' : existing.status === 'revision' ? 'revision' : input.status === 'draft' ? 'draft' : String(existing.status);
      const history = Array.isArray(existing.history) ? existing.history as Array<{ at: string; action: string; note?: string }> : [];
      const record = {
        ...existing, ...fields, id, ownerId: user.userId, organizerName: String(profile.displayName || ''),
        posterPath, posterName: String(input.posterName || existing.posterName || ''), posterContentType: String(input.posterContentType || existing.posterContentType || ''),
        responsibilityLetterPath, status, updatedAt: timestamp,
        adminNote: status === 'pending' && existing.status === 'revision' ? '' : String(existing.adminNote || ''),
        history: [...history, { at: timestamp, action: existing.status === 'published' ? 'Acara terbit diperbarui' : status === 'pending' ? 'Pengajuan dikirim ulang' : 'Draf diperbarui' }].slice(-40),
      };
      const [ok] = await db.update('event_submissions', [{ id: found!.storageId, record: { ...record, id: String(existing.id || id), eventId: String(existing.eventId || existing.id || id) } }]);
      if (!ok) return error('Perubahan acara gagal disimpan.', 500);
      return json({ id, status });
    },
  ],

  'GET /api/public/events': [
    async () => {
      const today = jakartaToday();
      const all = await getAllEvents();
      const published = all.filter(item => item.status === 'published' && (!String(item.endDate || '') || String(item.endDate) >= today));
      return json({ events: await recordsWithPosterUrls(published as Array<Record<string, unknown> & { posterPath?: string; posterUrl?: string }>) });
    },
  ],

  'GET /api/public/events/archive': [
    async () => {
      const today = jakartaToday();
      const all = await getAllEvents();
      const archived = all.filter(item => item.status === 'cancelled' || (item.status === 'published' && Boolean(String(item.endDate || '')) && String(item.endDate) < today))
        .sort((a, b) => String(b.endDate || '').localeCompare(String(a.endDate || '')));
      return json({ events: await recordsWithPosterUrls(archived as Array<Record<string, unknown> & { posterPath?: string; posterUrl?: string }>) });
    },
  ],

  'POST /api/organizer/events/:id/cancel-request': [
    requireAuth(),
    async (ctx) => {
      const user = ctx.user!;
      const found = await findEventRecord(ctx.params.id);
      const existing = found?.record;
      if (!existing || existing.ownerId !== user.userId) return error('Acara tidak ditemukan pada akun ini.', 404);
      if (existing.status !== 'published' || existing.cancellationRequested === true) return error('Acara ini tidak dapat diajukan pembatalannya.', 400);
      const body = (ctx.body || {}) as { reason?: string };
      const reason = String(body.reason || '').trim();
      if (reason.length < 10) return error('Jelaskan alasan pembatalan minimal 10 karakter.', 400);
      const timestamp = now();
      const history = Array.isArray(existing.history) ? existing.history as Array<{ at: string; action: string; note?: string }> : [];
      const record = { ...existing, status: 'published', cancellationRequested: true, cancellationReason: reason.slice(0, 1500), cancellationRequestedAt: timestamp, updatedAt: timestamp, history: [...history, { at: timestamp, action: 'Penyelenggara mengajukan pembatalan', note: reason }].slice(-40) };
      const [ok] = await db.update('event_submissions', [{ id: found!.storageId, record: { ...record, id: String(existing.id || ctx.params.id), eventId: String(existing.eventId || existing.id || ctx.params.id) } }]);
      if (!ok) return error('Pengajuan pembatalan gagal disimpan.', 500);
      return json({ id: ctx.params.id, status: 'cancellation_requested' });
    },
  ],

  'GET /api/public/organizers/:id': [
    async (ctx) => {
      const [profile] = await db.get<Record<string, unknown>>('organizer_profiles', [ctx.params.id], { consistent: true });
      if (!profile) return error('Profil penyelenggara tidak ditemukan.', 404);
      const all = await getAllEvents();
      const published = all.filter(item => item.ownerId === ctx.params.id && item.status === 'published');
      if (!published.length) return error('Profil publik tersedia setelah acara pertama disetujui.', 404);
      return json({ profile, events: await recordsWithPosterUrls(published as Array<Record<string, unknown> & { posterPath?: string; posterUrl?: string }>) });
    },
  ],

  'GET /api/access/me': [
    requireAuth(),
    async (ctx) => json({ role: await getUserRole(ctx.user?.email) }),
  ],

  'GET /api/admin/overview': [
    requireAuth(),
    async (ctx) => {
      const denied = await adminGuard(ctx, 'superadmin'); if (denied) return denied;
      const all = await getAllEvents();
      const admins = await db.list<{ email: string; active: boolean }>('eventara_admins', { limit: 200 });
      return json({ events: all.length, pending: all.filter(item => item.status === 'pending').length, published: all.filter(item => item.status === 'published').length, revision: all.filter(item => item.status === 'revision').length, rejected: all.filter(item => item.status === 'rejected').length, admins: admins.items.filter(item => item.active).length });
    },
  ],

  'GET /api/admin/users': [
    requireAuth(),
    async (ctx) => {
      const denied = await adminGuard(ctx, 'superadmin');
      if (denied) return denied;
      const result = await db.list<{ email: string; active: boolean; createdAt?: string; updatedAt?: string }>('eventara_admins', { limit: 200 });
      return json({ admins: result.items.filter(item => item.active).map(item => ({ email: item.email, active: item.active, createdAt: item.createdAt, updatedAt: item.updatedAt })) });
    },
  ],

  'POST /api/admin/users': [
    requireAuth(),
    async (ctx) => {
      const denied = await adminGuard(ctx, 'superadmin');
      if (denied) return denied;
      const body = (ctx.body || {}) as { email?: string; action?: string };
      const email = normalizeEmail(String(body.email || ''));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('Alamat email admin tidak valid.', 400);
      if (body.action !== 'grant' && body.action !== 'revoke') return error('Tindakan pengelolaan admin tidak valid.', 400);
      if (normalizeEmail(ctx.user?.email || '') === email) return error('Superadmin tidak perlu menambahkan dirinya sendiri sebagai admin.', 400);
      if ((await configuredEmails('EVENTARA_SUPERADMIN_EMAILS')).includes(email)) return error('Akun superadmin tidak dapat dikelola sebagai admin biasa.', 400);
      const id = adminRecordId(email);
      const [existing] = await db.get<{ email: string; active: boolean; createdAt?: string }>('eventara_admins', [id], { consistent: true });
      const timestamp = now();
      if (body.action === 'grant') {
        const record = { email, active: true, createdAt: existing?.createdAt || timestamp, updatedAt: timestamp, grantedBy: normalizeEmail(ctx.user?.email || '') };
        if (existing) {
          const [ok] = await db.update('eventara_admins', [{ id, record }]);
          if (!ok) return error('Akses admin gagal diperbarui.', 500);
        } else {
          const [saved] = await db.tx.add('eventara_admins', [{ id, ...record }]);
          if (!saved) return error('Akses admin gagal dibuat.', 500);
        }
      } else {
        if (!existing) return error('Akun admin tidak ditemukan.', 404);
        const [ok] = await db.update('eventara_admins', [{ id, record: { ...existing, email, active: false, updatedAt: timestamp, revokedBy: normalizeEmail(ctx.user?.email || '') } }]);
        if (!ok) return error('Akses admin gagal dicabut.', 500);
      }
      await writeAdminAudit(ctx, body.action === 'grant' ? 'admin_granted' : 'admin_revoked', email);
      return json({ email, active: body.action === 'grant' });
    },
  ],

  'GET /api/admin/audit': [
    requireAuth(),
    async (ctx) => {
      const denied = await adminGuard(ctx, 'superadmin');
      if (denied) return denied;
      const result = await db.list<Record<string, unknown>>('eventara_admin_audit', { limit: 100 });
      return json({ entries: result.items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))) });
    },
  ],

  'POST /api/admin/events/:id/cancellation': [
    requireAuth(),
    async (ctx) => {
      const denied = await adminGuard(ctx); if (denied) return denied;
      const body = (ctx.body || {}) as { action?: string; note?: string };
      if (!['approve', 'reject', 'direct'].includes(String(body.action))) return error('Tindakan pembatalan tidak valid.', 400);
      const note = String(body.note || '').trim();
      if (note.length < 5) return error('Alasan atau catatan admin wajib diisi minimal 5 karakter.', 400);
      const found = await findEventRecord(ctx.params.id);
      const existing = found?.record;
      if (!existing) return error('Acara tidak ditemukan.', 404);
      if (body.action === 'approve' && existing.cancellationRequested !== true) return error('Tidak ada permohonan pembatalan yang menunggu keputusan.', 400);
      if (body.action === 'reject' && existing.cancellationRequested !== true) return error('Permohonan pembatalan tidak ditemukan.', 400);
      if (body.action === 'direct' && existing.status !== 'published') return error('Admin hanya dapat membatalkan acara yang sedang diterbitkan.', 400);
      const timestamp = now();
      const cancelled = body.action !== 'reject';
      const history = Array.isArray(existing.history) ? existing.history as Array<{ at: string; action: string; note?: string }> : [];
      const record = { ...existing, status: cancelled ? 'cancelled' : 'published', cancellationRequested: false, cancellationAdminNote: note, updatedAt: timestamp, cancelledAt: cancelled ? timestamp : '', history: [...history, { at: timestamp, action: body.action === 'approve' ? 'Pembatalan disetujui admin' : body.action === 'direct' ? 'Acara dibatalkan langsung oleh admin' : 'Permohonan pembatalan ditolak', note }].slice(-40) };
      const [ok] = await db.update('event_submissions', [{ id: found!.storageId, record: { ...record, id: String(existing.id || ctx.params.id), eventId: String(existing.eventId || existing.id || ctx.params.id) } }]);
      if (!ok) return error('Status pembatalan gagal disimpan.', 500);
      await writeAdminAudit(ctx, body.action === 'reject' ? 'event_cancellation_rejected' : 'event_cancelled', ctx.params.id, note);
      return json({ id: ctx.params.id, status: record.status });
    },
  ],

  'GET /api/admin/events': [
    requireAuth(),
    async (ctx) => {
      const denied = await adminGuard(ctx);
      if (denied) return denied;
      const all = await getAllEvents();
      const withUrls = await recordsWithPosterUrls(all as Array<Record<string, unknown> & { posterPath?: string; posterUrl?: string }>);
      const visible = withUrls.map(item => item.cancellationRequested === true ? { ...item, status: 'cancellation_requested' } : item);
      return json({ events: visible.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))) });
    },
  ],

  'POST /api/admin/events/:id/review': [
    requireAuth(),
    async (ctx) => {
      const denied = await adminGuard(ctx);
      if (denied) return denied;
      const id = ctx.params.id;
      const body = (ctx.body || {}) as { action?: string; note?: string };
      if (!['approve', 'revision', 'reject'].includes(String(body.action))) return error('Keputusan admin tidak valid.', 400);
      if ((body.action === 'revision' || body.action === 'reject') && !String(body.note || '').trim()) return error('Catatan wajib untuk revisi atau penolakan.', 400);
      const found = await findEventRecord(id);
      const existing = found?.record;
      if (!existing) return error('Pengajuan tidak ditemukan.', 404);
      const timestamp = now();
      const nextStatus = body.action === 'approve' ? 'published' : body.action === 'revision' ? 'revision' : 'rejected';
      const history = Array.isArray(existing.history) ? existing.history as Array<{ at: string; action: string; note?: string }> : [];
      const actionText = body.action === 'approve' ? 'Disetujui dan diterbitkan' : body.action === 'revision' ? 'Perlu revisi' : 'Ditolak';
      const record = {
        ...existing, status: nextStatus, adminNote: String(body.note || '').trim().slice(0, 1500),
        updatedAt: timestamp, publishedAt: body.action === 'approve' ? timestamp : String(existing.publishedAt || ''),
        history: [...history, { at: timestamp, action: actionText, note: String(body.note || '').trim() }].slice(-40),
      };
      const [ok] = await db.update('event_submissions', [{ id: found!.storageId, record: { ...record, id: String(existing.id || id), eventId: String(existing.eventId || existing.id || id) } }]);
      if (!ok) return error('Keputusan admin gagal disimpan.', 500);
      await writeAdminAudit(ctx, 'event_' + String(body.action), id, 'Status: ' + nextStatus);
      return json({ id, status: nextStatus });
    },
  ],
});
