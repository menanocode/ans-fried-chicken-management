import { supabase } from '../config/supabase.js';
import { auth } from './auth.js';

const LOG_TABLE = 'activity_logs';
const LOG_LIMIT = 120;

let remoteLogState = 'unknown';

function getUserScopedKey(prefix) {
  const userId = auth.user?.id || 'guest';
  return `${prefix}:${userId}`;
}

function getLocalLogKey() {
  return getUserScopedKey('ans_activity_logs');
}

function getSeenAtKey() {
  return getUserScopedKey('ans_activity_seen_at');
}

function toDateValue(dateLike) {
  if (!dateLike) return 0;
  const value = new Date(dateLike).getTime();
  return Number.isFinite(value) ? value : 0;
}

function isMissingRemoteLogError(error) {
  const code = error?.code || '';
  const message = String(error?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST202' ||
    message.includes('activity_logs') && message.includes('not found')
  );
}

function emitActivityChanged() {
  window.dispatchEvent(new CustomEvent('activity-log-updated'));
}

function readLocalLogs() {
  try {
    const raw = localStorage.getItem(getLocalLogKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(entry => entry && entry.id && entry.created_at)
      .sort((a, b) => toDateValue(b.created_at) - toDateValue(a.created_at));
  } catch {
    return [];
  }
}

function writeLocalLogs(entries) {
  const trimmed = entries
    .slice()
    .sort((a, b) => toDateValue(b.created_at) - toDateValue(a.created_at))
    .slice(0, LOG_LIMIT);
  try {
    localStorage.setItem(getLocalLogKey(), JSON.stringify(trimmed));
  } catch {
    // Abaikan kegagalan penyimpanan lokal.
  }
}

function pushLocalActivity(payload) {
  const entry = {
    id: `local-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    action: payload.action || 'update',
    entity_type: payload.entity_type || 'system',
    entity_id: payload.entity_id || null,
    title: payload.title || 'Aktivitas baru',
    description: payload.description || '',
    actor_id: auth.user?.id || null,
    actor_role: auth.getRole() || null,
    outlet_id: payload.outlet_id ?? auth.getOutletId() ?? null,
    metadata: payload.metadata || null,
    created_at: new Date().toISOString(),
    source: 'local',
  };

  const logs = readLocalLogs();
  logs.unshift(entry);
  writeLocalLogs(logs);
  return entry;
}

function normalizeRemoteRow(row) {
  return {
    id: row.id,
    action: row.action || 'update',
    entity_type: row.entity_type || 'system',
    entity_id: row.entity_id || null,
    title: row.title || 'Aktivitas baru',
    description: row.description || '',
    actor_id: row.actor_id || null,
    actor_role: row.actor_role || null,
    outlet_id: row.outlet_id || null,
    metadata: row.metadata || null,
    created_at: row.created_at,
    source: 'remote',
  };
}

function filterLogsForAudience(logs) {
  if (auth.isAdmin() || auth.isManagement()) return logs;

  const outletId = auth.getOutletId();
  const userId = auth.user?.id;

  return logs.filter(log => (
    (userId && log.actor_id === userId) ||
    (outletId && log.outlet_id === outletId)
  ));
}

export async function recordActivity(payload) {
  const safePayload = {
    action: payload?.action || 'update',
    entity_type: payload?.entity_type || 'system',
    entity_id: payload?.entity_id || null,
    title: payload?.title || 'Aktivitas baru',
    description: payload?.description || '',
    metadata: payload?.metadata || null,
    outlet_id: payload?.outlet_id ?? auth.getOutletId() ?? null,
  };

  if (!auth.user || remoteLogState === 'missing') {
    const localEntry = pushLocalActivity(safePayload);
    emitActivityChanged();
    return localEntry;
  }

  const { data, error } = await supabase.from(LOG_TABLE)
    .insert({
      actor_id: auth.user.id,
      actor_role: auth.getRole() || null,
      outlet_id: safePayload.outlet_id,
      action: safePayload.action,
      entity_type: safePayload.entity_type,
      entity_id: safePayload.entity_id,
      title: safePayload.title,
      description: safePayload.description,
      metadata: safePayload.metadata,
    })
    .select('*')
    .single();

  if (error) {
    if (isMissingRemoteLogError(error)) remoteLogState = 'missing';
    const localEntry = pushLocalActivity(safePayload);
    emitActivityChanged();
    return localEntry;
  }

  remoteLogState = 'available';
  emitActivityChanged();
  return normalizeRemoteRow(data);
}

export async function getActivityLogs(options = {}) {
  const limit = Number(options.limit) > 0 ? Number(options.limit) : 40;

  if (auth.user && remoteLogState !== 'missing') {
    const { data, error } = await supabase.from(LOG_TABLE)
      .select('id, action, entity_type, entity_id, title, description, actor_id, actor_role, outlet_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!error) {
      remoteLogState = 'available';
      return (data || []).map(normalizeRemoteRow);
    }

    if (isMissingRemoteLogError(error)) {
      remoteLogState = 'missing';
    } else {
      console.warn('Gagal memuat activity_logs dari database, menggunakan log lokal.', error);
    }
  }

  const localLogs = readLocalLogs();
  return filterLogsForAudience(localLogs).slice(0, limit);
}

export function markActivityLogsSeen() {
  try {
    localStorage.setItem(getSeenAtKey(), new Date().toISOString());
  } catch {
    // Abaikan kegagalan penyimpanan lokal.
  }
  emitActivityChanged();
}

export function getActivityLogsSeenAt() {
  let seenAt = null;
  try {
    seenAt = localStorage.getItem(getSeenAtKey());
  } catch {
    seenAt = null;
  }
  const date = seenAt ? new Date(seenAt) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date;
}

export async function getUnreadActivityCount(options = {}) {
  const logs = await getActivityLogs({ limit: options.limit || 80 });
  const seenAt = getActivityLogsSeenAt();
  if (!seenAt) return logs.length;
  const seenTime = seenAt.getTime();
  return logs.filter(log => toDateValue(log.created_at) > seenTime).length;
}

auth.onChange(() => {
  remoteLogState = 'unknown';
  emitActivityChanged();
});
