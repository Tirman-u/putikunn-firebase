import { useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function useRealtimeDuelGame({
  gameId,
  enabled = true,
  throttleMs = 1000,
  onEvent,
  onError,
}) {
  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  const throttleRef = useRef({ timer: null, latest: null });

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!enabled || !gameId) return undefined;

    let cancelled = false;

    const resetThrottle = () => {
      const throttle = throttleRef.current;
      if (throttle.timer) clearTimeout(throttle.timer);
      throttle.timer = null;
      throttle.latest = null;
    };

    const deliverEvent = (event) => {
      if (cancelled) return;
      try {
        onEventRef.current?.(event);
      } catch (error) {
        onErrorRef.current?.(error);
      }
    };

    const handleEvent = (event) => {
      if (!throttleMs || throttleMs <= 0) {
        deliverEvent(event);
        return;
      }

      const throttle = throttleRef.current;
      if (!throttle.timer) {
        deliverEvent(event);
        throttle.timer = setTimeout(() => {
          if (throttle.latest) {
            const latestEvent = throttle.latest;
            throttle.latest = null;
            deliverEvent(latestEvent);
          }
          throttle.timer = null;
        }, throttleMs);
      } else {
        throttle.latest = event;
      }
    };

    const unsubscribe = onSnapshot(
      doc(db, 'duel_games', gameId),
      (snapshot) => {
        if (cancelled) return;
        resetThrottle(); 

        let event;
        if (snapshot.exists()) {
          event = {
            type: 'update',
            id: snapshot.id,
            data: snapshot.data(),
          };
        } else {
          event = {
            type: 'delete',
            id: gameId,
            data: null,
          };
        }
        handleEvent(event);
      },
      (error) => {
        if (cancelled) return;
        onErrorRef.current?.(error);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
      resetThrottle();
    };
  }, [enabled, gameId, throttleMs]);
}
