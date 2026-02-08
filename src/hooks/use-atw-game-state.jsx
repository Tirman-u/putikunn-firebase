import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { getATWMovement, isATWRoundComplete, shouldATWRestart } from '@/components/putting/gameRules';
import { useAuth } from '@/lib/AuthContext';

// Placeholder for leaderboard functionality
// import { resolveLeaderboardPlayer, buildLeaderboardIdentityFilter, getLeaderboardEmail } from '@/lib/leaderboard-utils';

export default function useATWGameState({ gameId, playerName, isSolo }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const ATW_SYNC_DELAY_MS_SOLO = 1500;
  const ATW_SYNC_DELAY_MS_MULTI = 250;
  const pendingUpdateRef = useRef([]);
  const updateTimeoutRef = useRef(null);
  const localSeqRef = useRef(0);
  const lastActionRef = useRef({ type: null, at: 0 });
  const lastSyncRef = useRef(0);
  const turnsSinceSyncRef = useRef(0);
  const UNDO_SOFT_LOCK_MS = 200;

  const bumpLocalSeq = useCallback(() => {
    localSeqRef.current += 1;
    return localSeqRef.current;
  }, []);

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const gameDocRef = doc(db, "games", gameId);
      const gameDocSnap = await getDoc(gameDocRef);
      return gameDocSnap.exists() ? { id: gameDocSnap.id, ...gameDocSnap.data() } : null;
    },
    enabled: !!gameId,
    refetchOnWindowFocus: false, 
  });

  useEffect(() => {
      if (!gameId || isSolo) return;
      const unsub = onSnapshot(doc(db, "games", gameId), (snapshot) => {
          if (snapshot.exists()) {
              queryClient.setQueryData(['game', gameId], { id: snapshot.id, ...snapshot.data() });
          }
      });
      return () => unsub();
  }, [gameId, isSolo, queryClient]);


  const getLatestGame = useCallback(() => {
    return queryClient.getQueryData(['game', gameId]) || game;
  }, [game, gameId, queryClient]);

  const defaultPlayerState = useMemo(() => ({
    // ... same as before
  }), []);

  const updateGameMutation = useMutation({
      mutationFn: async (updatePayload) => {
          if(!gameId) return;
          const gameDocRef = doc(db, "games", gameId);
          await updateDoc(gameDocRef, updatePayload);
      },
      onError: (error) => {
          toast.error('Viga mängu uuendamisel: ' + error.message);
          queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      }
  });

  const handleSubmitPutts = useCallback((madePutts) => {
    lastActionRef.current = { type: madePutts === 0 ? 'missed' : 'made', at: Date.now() };
    const latestGame = getLatestGame();
    if (!latestGame) return;
    
    const config = latestGame.atw_config;
    const playerUid = user?.uid;
    if (!config || !playerUid) return;

    const playerState = { ...defaultPlayerState, ...(latestGame.atw_state?.[playerUid] || {}) };

    const { newIndex, newDirection, lapEvent, pointsAwarded, newDistancePoints, movedToNewDistance } = getATWMovement({
        // ... logic from original hook
    });
    
    const updatedState = {
        // ... construct new player state
    };

    const newTotalPoints = (latestGame.total_points?.[playerUid] || 0) + pointsAwarded;

    queryClient.setQueryData(['game', gameId], prev => ({
        ...prev,
        atw_state: { ...(prev.atw_state || {}), [playerUid]: updatedState },
        total_points: { ...(prev.total_points || {}), [playerUid]: newTotalPoints },
    }));

    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);

    updateTimeoutRef.current = setTimeout(() => {
        const gameToUpdate = queryClient.getQueryData(['game', gameId]);
        const stateToUpdate = gameToUpdate?.atw_state?.[playerUid];
        const pointsToUpdate = gameToUpdate?.total_points?.[playerUid];

        if(stateToUpdate) {
            updateGameMutation.mutate({
                [`atw_state.${playerUid}`]: stateToUpdate,
                [`total_points.${playerUid}`]: pointsToUpdate,
            });
        }
    }, isSolo ? ATW_SYNC_DELAY_MS_SOLO : ATW_SYNC_DELAY_MS_MULTI);

  }, [getLatestGame, user, gameId, queryClient, updateGameMutation, isSolo, defaultPlayerState]);
  
  const handleUndo = useCallback(() => {
      // ... Undo logic needs to be rewritten with Firestore in mind
      // This is a complex operation and will be simplified for now
      toast.info("Tagasivõtmine on ajutiselt deaktiveeritud.");
  }, []);

  const handleCompleteGame = useCallback(() => {
      if (!gameId || !user) return;
      updateGameMutation.mutate({ status: 'completed' });
      // navigate or show summary
  }, [gameId, user, updateGameMutation]);
  
  const handlePlayAgain = useCallback(() => {
      // ... Play again logic needs to be rewritten
      toast.info("Uuesti mängimine on ajutiselt deaktiveeritud.");
  }, []);

  const handleExit = useCallback(() => {
      if (isSolo) {
        handleCompleteGame();
      }
      navigate(createPageUrl('Home'));
  }, [isSolo, handleCompleteGame, navigate]);
  
  const playerState = useMemo(
    () => ({ ...defaultPlayerState, ...(game?.atw_state?.[user?.uid] || {}) }),
    [game?.atw_state, user?.uid, defaultPlayerState]
  );

  const gameStats = useMemo(() => {
    if (!game?.atw_config) return null;
    const config = game.atw_config;
    const currentDistance = config.distances?.[playerState.current_distance_index || 0];
    const totalScore = game?.total_points?.[user?.uid] || 0;
    return { currentDistance, totalScore, bestScore: playerState.best_score || 0, makeRate: 0 }; // Simplified
  }, [game, playerState, user?.uid]);


  return {
    game,
    isLoading,
    config: game?.atw_config,
    playerState,
    gameStats,
    handleSubmitPutts,
    handleUndo,
    handleCompleteGame,
    handlePlayAgain,
    handleExit,
    // submitToLeaderboardMutation: { mutate: () => toast.info('Leaderboard coming soon!') }
  };
}
