import { Ban, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PublicUser } from '../../shared/types';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { Button, Label, Modal, Pill, Textarea, useToast } from '../components/ui';

export type SuspendTarget = Pick<PublicUser, 'id' | 'name' | 'active' | 'suspension'>;

/** "Suspended" badge with who and when, for the instructor's learner lists. */
export function SuspendedBadge({ user }: { user: SuspendTarget }) {
  if (user.active) return null;
  const s = user.suspension;
  return (
    <span title={s ? `Suspended ${fmtDate(s.at)} by ${s.byName}${s.reason ? ` · ${s.reason}` : ''}` : 'Suspended'}>
      <Pill color="pink">Suspended</Pill>
    </span>
  );
}

/**
 * Suspend a learner (with an optional note only instructors see), or reinstate one.
 * `onDone` receives the updated learner so the list can change without a full reload.
 */
export default function SuspendModal({ target, onClose, onDone }: { target: SuspendTarget | null; onClose: () => void; onDone: (u: PublicUser) => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const suspending = !!target?.active;

  useEffect(() => {
    if (target) setReason('');
  }, [target]);

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const r = await api<{ user: PublicUser }>(`/staff/learners/${encodeURIComponent(target.id)}/suspend`, { body: { suspend: suspending, reason: suspending ? reason : undefined } });
      toast('success', suspending ? `${target.name} is suspended and has been signed out.` : `${target.name} can sign in again.`);
      onDone(r.user);
      onClose();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const first = target?.name.split(' ')[0] ?? '';

  return (
    <Modal
      open={!!target}
      onClose={() => !busy && onClose()}
      title={suspending ? `Suspend ${target?.name ?? ''}?` : `Reinstate ${target?.name ?? ''}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {suspending ? (
            <Button variant="danger" loading={busy} icon={<Ban className="h-4 w-4" />} onClick={() => void submit()}>
              Suspend learner
            </Button>
          ) : (
            <Button variant="success" loading={busy} icon={<UserCheck className="h-4 w-4" />} onClick={() => void submit()}>
              Reinstate learner
            </Button>
          )}
        </>
      }
    >
      {suspending ? (
        <div className="space-y-4 text-sm text-ink-soft">
          <ul className="list-disc space-y-1 pl-5">
            <li>{first} is signed out on their next click and cannot sign in until you reinstate them. They see “Your account is suspended. Please contact your instructor.”</li>
            <li>Nothing is deleted: progress, submissions, messages, and course access are all kept.</li>
            <li>While suspended, {first} is left out of Cohort figures and reminders, and is listed under “Suspended learners”.</li>
          </ul>
          <div>
            <Label htmlFor="suspend-reason" hint="Optional. Only instructors see this.">
              Note
            </Label>
            <Textarea id="suspend-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="For example: Contract paused until March" className="!min-h-[72px]" />
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm text-ink-soft">
          {target?.suspension && (
            <p>
              Suspended {fmtDate(target.suspension.at)} by {target.suspension.byName}
              {target.suspension.reason ? `: “${target.suspension.reason}”` : '.'}
            </p>
          )}
          <p>{first} can sign in again straight away and continues exactly where they left off. They get a notification that their access is back.</p>
        </div>
      )}
    </Modal>
  );
}
