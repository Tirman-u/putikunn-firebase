import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';

export default function usePlayerGameState({ gameId }) {
  const { user, isLoading: isLoadingUser } = useAuth();

  const { data: game, isLoading: isLoadingGame } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      if (!gameId) return null;
      const gameDocRef = doc(db, "games", gameId);
      const gameDocSnap = await getDoc(gameDocRef);
      return gameDocSnap.exists() ? { id: gameDocSnap.id, ...gameDocSnap.data() } : null;
    },
    enabled: !!gameId,
  });

  const isSoloGame = game?.pin === '0000';

  return { user, game, isLoading: isLoadingUser || isLoadingGame, isSoloGame };
}
