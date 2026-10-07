import { motion } from 'motion/react';
import { Award, BadgeCheck, CheckCircle2, Trophy } from 'lucide-react';
import { useState } from 'react';
import { fmtDate } from '../lib/format';
import { Bar, Button, Card, cx, Empty, navigate, PageHeader, Tabs } from '../components/ui';
import Credential, { Badge } from './Credential';
import { useLearner } from './context';

type VaultTab = 'certifications' | 'badges';

/**
 * Milestone Vault.
 * One place for everything the learner has earned or made: certifications,
 * digital badges and the work itself. Three buttons, nothing hidden.
 */
export default function Vault({ initialTab }: { initialTab?: string }) {
  const { home, active } = useLearner();
  const [tab, setTab] = useState<VaultTab>((['certifications', 'badges'].includes(initialTab ?? '') ? initialTab : 'certifications') as VaultTab);

  const earnedCerts = home.items.filter((i) => i.snapshot.credentialEarned).length;

  if (!home.items.length) return <Empty icon={<Award className="h-6 w-6" />} title="Your vault is waiting" text="Join a course and your first milestone will appear here." action={<Button onClick={() => navigate('explore')}>Explore courses</Button>} />;

  return (
    <div data-tour="vault">
      <PageHeader
        eyebrow="Milestone Vault"
        title="Everything you have earned"
        subtitle="Your certifications, digital badges and project work, kept safely in one place."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {[
          { label: 'Certifications', value: earnedCerts, of: home.items.length, icon: <BadgeCheck className="h-5 w-5" />, color: '#1F6BFF', tab: 'certifications' as VaultTab },
          { label: 'Digital Badges', value: earnedCerts, of: home.items.length, icon: <Trophy className="h-5 w-5" />, color: '#8B3DFF', tab: 'badges' as VaultTab },
        ].map((s, i) => (
          <motion.button
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -3 }}
            onClick={() => setTab(s.tab)}
            className={cx('relative overflow-hidden rounded-3xl border bg-white p-4 text-left transition', tab === s.tab ? 'border-npurple/40 shadow-lg shadow-npurple/10' : 'border-line hover:border-nblue/40')}
          >
            <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.14] blur-xl" style={{ background: s.color }} />
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${s.color}1a`, color: s.color }}>
              {s.icon}
            </span>
            <div className="mt-2 font-display text-2xl font-bold">
              {s.value}
              {s.of !== null && <span className="text-base font-semibold text-ink-faint"> of {s.of}</span>}
            </div>
            <div className="text-[13px] font-semibold text-ink-soft">{s.label}</div>
          </motion.button>
        ))}
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'certifications', label: 'Certifications' },
          { value: 'badges', label: 'Digital Badges' },
        ]}
      />

      {tab === 'certifications' && (
        <div className="space-y-5">
          {home.items.length > 1 && (
            <Card className="!p-0 overflow-hidden">
              <div className="border-b border-line px-5 py-3 text-sm font-bold">All your courses</div>
              <ul>
                {home.items.map((i) => (
                  <li key={i.course.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-5 py-3 last:border-0">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{i.course.title}</div>
                        <div className="text-[12px] text-ink-faint">
                          {i.snapshot.credentialEarned ? `Issued ${fmtDate(i.enrollment.certificateIssuedAt)} · ID ${i.enrollment.certificateId}` : `${i.snapshot.completion.percent}% complete`}
                        </div>
                      </div>
                      <span className={cx('rounded-full px-3 py-1 text-[12px] font-bold', i.snapshot.credentialEarned ? 'bg-ngreen-soft text-ngreen-ink' : 'bg-mist text-ink-soft')}>
                        {i.snapshot.credentialEarned ? 'Earned' : 'In progress'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Credential embedded />
        </div>
      )}

      {tab === 'badges' && (
        <div className="space-y-5">
          <p className="text-sm text-ink-soft">One digital badge per course. It unlocks in full color the moment you earn that course&rsquo;s credential.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {home.items.map((i, n) => (
              <motion.div key={i.course.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: n * 0.07 }}>
                <Card className="flex h-full flex-wrap items-center gap-5">
                  <Badge name={i.course.credentialName} earned={i.snapshot.credentialEarned} size={140} />
                  <div className="min-w-[180px] flex-1">
                    <h3 className="font-display text-lg font-bold">{i.course.title}</h3>
                    <p className="mt-1 text-[13px] text-ink-soft">{i.course.credentialName}</p>
                    {i.snapshot.credentialEarned ? (
                      <>
                        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ngreen-soft px-3 py-1 text-[12px] font-bold text-ngreen-ink">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Earned {fmtDate(i.enrollment.certificateIssuedAt)}
                        </span>
                        <Button size="sm" variant="secondary" className="mt-3" onClick={() => setTab('certifications')}>
                          View Certificate
                        </Button>
                      </>
                    ) : (
                      <div className="mt-3">
                        <div className="flex justify-between text-[12px] font-semibold text-ink-soft">
                          <span>{i.snapshot.completion.percent}% complete</span>
                          <span>{Math.max(0, i.snapshot.completion.lessonsTotal - i.snapshot.completion.lessonsDone)} lessons to go</span>
                        </div>
                        <Bar value={i.snapshot.completion.percent} height={8} className="mt-1.5" />
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
