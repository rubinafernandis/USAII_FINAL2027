import { useState } from 'react';
import type { PublicUser } from '../../shared/types';
import { api } from '../lib/api';
import { Button, Modal, PasswordField, useToast } from '../components/ui';

/** Set a new password for a learner (used on Learners & Access). */
export function SetPasswordModal({ user, endpoint, onClose }: { user: PublicUser | null; endpoint: string; onClose: () => void }) {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await api(endpoint, { body: { password: pw } });
      toast('success', `New password set for ${user.name}.`);
      setPw('');
      onClose();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={`Set password for ${user?.name ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            Save password
          </Button>
        </>
      }
    >
      <PasswordField value={pw} onChange={setPw} id="set-pw" label="New password" />
      <p className="mt-3 text-xs text-ink-faint">Share the new password with {user?.name.split(' ')[0]} so they can sign in.</p>
    </Modal>
  );
}
