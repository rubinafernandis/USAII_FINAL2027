export const fmtDate = (d?: string | number | null, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  if (d === undefined || d === null || d === '') return '—';
  const date = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`) : new Date(d);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', opts);
};

export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export function timeAgo(d?: string | null) {
  if (!d) return 'never';
  const s = Math.round((Date.now() - Date.parse(d)) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return fmtDate(d);
}

export function fmtMinutes(m: number) {
  const n = Math.max(0, Math.round(m));
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const r = n % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

export const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${Math.round(n)}%`);

export function greeting(name: string) {
  return `Welcome, ${name.split(' ')[0]}!`;
}

export const ACCENT: Record<string, { hex: string; soft: string; text: string }> = {
  blue: { hex: '#1F6BFF', soft: '#EAF1FF', text: '#1F6BFF' },
  purple: { hex: '#8B3DFF', soft: '#F3EBFF', text: '#7A2FF0' },
  pink: { hex: '#FF2E93', soft: '#FFE9F4', text: '#E0197A' },
  green: { hex: '#00C77F', soft: '#E3FBF1', text: '#00804F' },
};
export const accentHex = (a?: string) => (ACCENT[a ?? 'blue'] ?? ACCENT.blue).hex;

/** Color a score: green strong, blue okay, purple developing, pink needs work. */
export function scoreColor(n: number | null | undefined) {
  if (n === null || n === undefined) return '#8A8AA3';
  if (n >= 85) return '#00C77F';
  if (n >= 70) return '#1F6BFF';
  if (n >= 55) return '#8B3DFF';
  return '#FF2E93';
}

export function youtubeEmbed(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, window.location.origin);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) return u.toString();
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      const m = u.pathname.match(/^\/shorts\/([\w-]+)/);
      if (m) return `https://www.youtube.com/embed/${m[1]}`;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    if (host === 'player.vimeo.com') return u.toString();
  } catch {
    return null;
  }
  return null;
}

export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
