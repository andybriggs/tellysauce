"use client";

import Modal from "@/components/common/Modal";
import BadgeRosette from "./BadgeRosette";
import BadgeCelebration from "./BadgeCelebration";
import { BADGE_BY_KEY } from "@/lib/badges";

type Props = {
  badgeKey: string;
  onClose: () => void;
  /** 1-based position in the unlock queue */
  position?: number;
  /** total badges queued */
  total?: number;
};

export default function BadgeUnlockModal({
  badgeKey,
  onClose,
  position = 1,
  total = 1,
}: Props) {
  const badge = BADGE_BY_KEY[badgeKey];
  if (!badge) return null;

  const hasMore = position < total;

  return (
    <Modal open onClose={onClose} labelledBy="badge-unlock-title">
      {/* Gradient frame - the app's established promo-card motif */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-3xl p-[1px]">
        <div className="bg-gray-900 rounded-3xl p-8 flex flex-col items-center text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-5 text-gray-400 hover:text-white transition text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>

          <p className="text-sm font-semibold uppercase tracking-widest text-pink-400 mb-1">
            Badge unlocked
          </p>

          <BadgeCelebration />
          <BadgeRosette tier={badge.tier} size={116} className="mb-3" />

          <h2
            id="badge-unlock-title"
            className="text-2xl font-bold text-white mb-2"
          >
            {badge.name}
          </h2>
          <p className="text-gray-300 mb-6 text-sm">{badge.unlockText}</p>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-pink-500 to-orange-400 hover:opacity-90 transition"
          >
            {hasMore ? "Next" : "Nice!"}
          </button>

          {total > 1 && (
            <p className="text-xs text-gray-500 mt-3">
              {position} of {total}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
