"use client";

import { useEffect, useState } from "react";
import useIsLoggedIn from "./useIsLoggedIn";

type SubscriptionStatus = {
  subscriptionStatus: string | null;
  freeRecCallsUsed: number;
};

export function useSubscriptionStatus() {
  const isLoggedIn = useIsLoggedIn();
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/subscription-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SubscriptionStatus | null) => {
        if (d) setSubStatus(d);
      })
      .catch(() => {});
  }, [isLoggedIn]);

  return subStatus;
}
