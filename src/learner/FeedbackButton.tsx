import { motion } from 'motion/react';
import { MessageSquareHeart } from 'lucide-react';
import { navigate } from '../components/ui';
import { useLearner } from './context';

export default function FeedbackButton() {
  const { readOnly } = useLearner();
  if (readOnly) return null;
  return (
    <>
      {/* Fixed to the right edge on desktop, clear of the reading controls on the left */}
      <motion.button
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => navigate('feedback')}
        aria-label="Give feedback"
        title="Give feedback"
        className="no-print fixed right-0 top-1/2 z-[65] hidden -translate-y-1/2 flex-col items-center gap-2 rounded-l-2xl bg-gradient-to-b from-nblue to-npurple py-4 pl-3 pr-2.5 text-sm font-bold text-white shadow-xl shadow-npurple/30 lg:flex"
      >
        <MessageSquareHeart className="h-5 w-5" />
        <span style={{ writingMode: 'vertical-rl' }}>Feedback</span>
      </motion.button>

      {/* On small screens it sits above the reading button instead */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('feedback')}
        aria-label="Give feedback"
        className="no-print fixed bottom-24 right-5 z-[65] flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-nblue to-npurple text-white shadow-xl shadow-npurple/30 lg:hidden"
      >
        <MessageSquareHeart className="h-5 w-5" />
      </motion.button>
    </>
  );
}
