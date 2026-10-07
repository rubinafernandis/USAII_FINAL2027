import { api } from '../lib/api';

/** A light usage signal (views and downloads of the Study Guide, the Study Plan, and the learner's own work) for instructor metrics. */
export function track(courseId: string, type: 'guide_view' | 'guide_download' | 'work_view' | 'work_download' | 'plan_view') {
  void api('/learner/track', { body: { courseId, type } }).catch(() => undefined);
}
