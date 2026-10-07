import { PageHeader } from '../components/ui';
import type { CourseItem } from './context';
import SkillTree from './SkillTree';

/** The Skill Tree on a page of its own, opened from Quick Tools. */
export default function SkillsPage({ item }: { item: CourseItem }) {
  return (
    <div>
      <PageHeader title="Skill Tree" subtitle="Every skill you have acquired so far. Tap a skill to review it." />
      <SkillTree item={item} />
    </div>
  );
}
