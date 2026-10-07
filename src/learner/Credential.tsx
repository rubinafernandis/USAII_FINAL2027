import { motion } from 'motion/react';
import { Award, CheckCircle2, Circle, Copy, Linkedin, Lock, Printer, ShieldCheck, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { Button, Card, Empty, ErrorBox, Loading, Logo, navigate, PageHeader, useLoad, useToast } from '../components/ui';
import { CourseSwitcher } from './Dashboard';
import { useLearner } from './context';

interface CredentialData {
  earned: boolean;
  certificateId?: string;
  issuedAt?: string;
  learnerName: string;
  courseTitle: string;
  credentialName: string;
  grade: number | null;
  requirements: { label: string; met: boolean }[];
}

export function Badge({ name, earned, size = 180 }: { name: string; earned: boolean; size?: number }) {
  return (
    <motion.div
      initial={{ rotate: -8, scale: 0.9, opacity: 0 }}
      animate={{ rotate: 0, scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 14 }}
      className="relative"
      style={{ width: size, height: size, filter: earned ? 'none' : 'grayscale(1) opacity(0.45)' }}
    >
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`${name} badge`}>
        <defs>
          <linearGradient id="bg-badge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1F6BFF" />
            <stop offset="0.5" stopColor="#8B3DFF" />
            <stop offset="1" stopColor="#FF2E93" />
          </linearGradient>
        </defs>
        <polygon points="100,6 181,53 181,147 100,194 19,147 19,53" fill="url(#bg-badge)" />
        <polygon points="100,20 169,60 169,140 100,180 31,140 31,60" fill="#fff" />
        <polygon points="100,30 160,65 160,135 100,170 40,135 40,65" fill="none" stroke="#00C77F" strokeWidth="3" />
        <text x="100" y="78" textAnchor="middle" fontFamily="Sora, sans-serif" fontWeight="800" fontSize="15" fill="#8B3DFF">
          USAII
        </text>
        <text x="100" y="108" textAnchor="middle" fontFamily="Sora, sans-serif" fontWeight="800" fontSize="22" fill="#14142b">
          CERTIFIED
        </text>
        <foreignObject x="45" y="116" width="110" height="40">
          <div style={{ fontFamily: 'Figtree, sans-serif', fontSize: 10, fontWeight: 600, color: '#4a4a68', textAlign: 'center', lineHeight: 1.2 }}>{name}</div>
        </foreignObject>
      </svg>
      {!earned && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Lock className="h-10 w-10 text-ink-soft" />
        </span>
      )}
    </motion.div>
  );
}

export default function Credential({ embedded }: { embedded?: boolean } = {}) {
  const { active, home, readOnly } = useLearner();
  const toast = useToast();
  const cid = active?.course.id ?? '';
  const { data, error, loading, reload } = useLoad(() => (cid && !readOnly ? api<CredentialData>(`/learner/credential/${cid}`) : Promise.resolve(null)), [cid, active?.enrollment.certificateIssuedAt]);
  if (!active) return <Empty icon={<Award className="h-6 w-6" />} title="No credentials yet" text="Enroll in a course to start earning one." />;
  if (readOnly) return <Empty title={active.enrollment.certificateId ? `Credential issued: ${active.enrollment.certificateId}` : 'Credential not yet earned'} />;
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Could not load your credential.'} onRetry={() => void reload()} />;
  const verifyUrl = data.certificateId ? `${window.location.origin}/#/verify/${data.certificateId}` : '';
  const done = data.requirements.filter((r) => r.met).length;
  return (
    <div className="space-y-6">
      <PageHeader
        title={embedded ? data.courseTitle : 'Certifications'}
        subtitle={data.earned ? 'Earned. Share it anywhere; anyone can verify it with the link.' : `${done} of ${data.requirements.length} requirements met.`}
        actions={home.items.length > 1 ? <CourseSwitcher /> : undefined}
      />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr] print:block">
        <Card className="no-print flex flex-col items-center text-center">
          <Badge name={data.credentialName} earned={data.earned} />
          <div className="mt-3 font-display font-bold">{data.credentialName}</div>
          <div className="mt-4 w-full space-y-2 text-left">
            {data.requirements.map((r) => (
              <div key={r.label} className="flex items-start gap-2 text-sm">
                {r.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ngreen" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-line" />}
                <span className={r.met ? 'text-ink' : 'text-ink-soft'}>{r.label}</span>
              </div>
            ))}
          </div>
          {!data.earned && (
            <Button className="mt-5 w-full" onClick={() => navigate('dashboard')}>
              Go to my next step
            </Button>
          )}
          {data.earned && (
            <div className="mt-5 grid w-full gap-2">
              <Button
                variant="secondary"
                icon={<Copy className="h-4 w-4" />}
                onClick={() =>
                  void navigator.clipboard?.writeText(verifyUrl).then(
                    () => toast('success', 'Verification link copied.'),
                    () => toast('info', verifyUrl),
                  )
                }
              >
                Copy verification link
              </Button>
              <Button
                variant="secondary"
                icon={<Linkedin className="h-4 w-4 text-nblue" />}
                onClick={() => {
                  const iss = data.issuedAt ? new Date(data.issuedAt) : new Date();
                  const u = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(data.credentialName)}&organizationName=${encodeURIComponent('United States Artificial Intelligence Institute')}&issueYear=${iss.getFullYear()}&issueMonth=${iss.getMonth() + 1}&certId=${data.certificateId}&certUrl=${encodeURIComponent(verifyUrl)}`;
                  window.open(u, '_blank', 'noopener');
                }}
              >
                Add to LinkedIn
              </Button>
              <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
                Print or save as PDF
              </Button>
            </div>
          )}
        </Card>

        <div id="certificate" className="always-light relative overflow-hidden rounded-[28px] border border-line bg-white p-2 shadow-xl">
          <div className="relative flex min-h-[420px] flex-col rounded-[22px] border-2 border-transparent p-8 text-center sm:p-12" style={{ background: 'linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg,#1F6BFF,#8B3DFF,#FF2E93,#00C77F) border-box' }}>
            {!data.earned && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[22px] bg-white/70 backdrop-blur-[2px]">
                <div className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white">Preview. Finish the requirements to unlock.</div>
              </div>
            )}
            <div className="mx-auto">
              <Logo />
            </div>
            <div className="mt-8 text-sm font-semibold text-ink-faint">Certificate of achievement</div>
            <div className="mt-1 text-sm text-ink-soft">This certifies that</div>
            <div className="neon-text mt-3 font-display text-4xl font-extrabold">{data.learnerName}</div>
            <div className="mt-3 text-ink-soft">has successfully completed</div>
            <div className="mt-2 font-display text-2xl font-bold">{data.courseTitle}</div>
            <div className="mt-1 text-ink-soft">and earned the {data.credentialName}</div>
            <div className="mt-auto grid grid-cols-3 gap-4 pt-10 text-left text-xs">
              <div>
                <div className="text-ink-faint">Issued</div>
                <div className="font-semibold">{data.issuedAt ? fmtDate(data.issuedAt) : '—'}</div>
              </div>
              <div className="text-center">
                <div className="text-ink-faint">Final grade</div>
                <div className="font-semibold">{data.earned && data.grade !== null ? `${data.grade}%` : '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-ink-faint">Credential ID</div>
                <div className="font-semibold">{data.certificateId ?? '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VerifyPage({ certId }: { certId: string }) {
  const { data, error, loading } = useLoad(
    () => fetch(`/api/public/verify/${encodeURIComponent(certId)}`).then(async (r) => ((await r.json()) as { valid?: boolean; learnerName?: string; credentialName?: string; courseTitle?: string; issuedAt?: string; error?: string })),
    [certId],
  );
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="aurora">
        <span />
        <span />
        <span />
        <span />
      </div>
      <Card className="relative w-full max-w-md text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        {loading ? (
          <Loading label="Checking credential…" />
        ) : error || !data?.valid ? (
          <div className="py-8">
            <XCircle className="mx-auto h-12 w-12 text-npink" />
            <h1 className="mt-3 text-xl font-bold">Credential not found</h1>
            <p className="mt-1 text-sm text-ink-soft">No credential matches ID {certId}.</p>
          </div>
        ) : (
          <div className="py-8">
            <ShieldCheck className="mx-auto h-12 w-12 text-ngreen" />
            <h1 className="mt-3 text-xl font-bold">Verified credential</h1>
            <p className="mt-4 font-display text-2xl font-extrabold">{data.learnerName}</p>
            <p className="mt-1 text-ink-soft">earned the {data.credentialName}</p>
            <p className="text-sm text-ink-faint">
              {data.courseTitle}, issued {fmtDate(data.issuedAt)}
            </p>
            <p className="mt-3 text-xs text-ink-faint">ID {certId}</p>
          </div>
        )}
        <Button variant="secondary" onClick={() => (window.location.hash = '')}>
          Go to USAII Learning
        </Button>
      </Card>
    </div>
  );
}
