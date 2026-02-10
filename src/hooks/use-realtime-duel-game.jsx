import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export default function useRealtimeDuelGame({
  gameId,
  enabled = true,
  allowCollection = false,
  throttleMs = 1000,
  eventTypes = ['update', 'delete'],
  onEvent,
  filterEvent,
  onError,
  retryMs = 2000,
  maxRetryMs = 30000
}) {
  const onEventRef = useRef(onEvent);
  const filterRef = useRef(filterEvent);
  const onErrorRef = useRef(onError);
  const eventTypesRef = useRef(eventTypes);
  const throttleRef = useRef({ timer: null, latest: null });
  const retryRef = useRef({ timer: null, delay: retryMs });
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    filterRef.current = filterEvent;
  }, [filterEvent]);

  useEffect(() => {
    eventTypesRef.current = eventTypes;
  }, [eventTypes]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!enabled || !onEventRef.current) return undefined;
    if (!gameId && !allowCollection) return undefined;

    let cancelled = false;

    const resetThrottle = () => {
      const throttle = throttleRef.current;
      if (throttle.timer) clearTimeout(throttle.timer);
      throttle.timer = null;
      throttle.latest = null;
    };

    const resetRetry = () => {
      if (retryRef.current.timer) clearTimeout(retryRef.current.timer);
      retryRef.current.timer = null;
      retryRef.current.delay = retryMs;
    };

    const shouldHandleEvent = (event) => {
      const filterFn = filterRef.current;
      if (filterFn) return filterFn(event);
      const allowedTypes = eventTypesRef.current;
      if (allowedTypes && !allowedTypes.includes(event.type)) return false;
      if (gameId && event.id !== gameId) return false;
      return true;
    };

    const deliverEvent = (event) => {
      try {
        onEventRef.current?.(event);
      } catch (error) {
        onErrorRef.current?.(error);
      }
    };

    const handleEvent = (event) => {
      if (!shouldHandleEvent(event)) return;
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

    const subscribe = () => {
      if (cancelled) return;
      try {
        const unsubscribe = gameId
          ? base44.entities.DuelGame.subscribeDoc(gameId, handleEvent)
          : base44.entities.DuelGame.subscribe(handleEvent);
        unsubscribeRef.current = unsubscribe;
        resetRetry();
      } catch (error) {
        onErrorRef.current?.(error);
        if (!retryRef.current.timer) {
          retryRef.current.timer = setTimeout(() => {
            retryRef.current.timer = null;
            retryRef.current.delay = Math.min(retryRef.current.delay * 1.5, maxRetryMs);
            subscribe();
          }, retryRef.current.delay);
        }
      }
    };

    subscribe();

    return () => {
      cancelled = true;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      resetThrottle();
      resetRetry();
    };
  }, [allowCollection, enabled, gameId, maxRetryMs, retryMs, throttleMs]);
}
