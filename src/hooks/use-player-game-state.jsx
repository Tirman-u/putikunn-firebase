import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function usePlayerGameState({ gameId }) {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const games = await base44.entities.Game.filter({ id: gameId });
      return games[0];
    },
    refetchInterval: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  const isSoloGame = game?.pin === '0000';

  return { user, game, isLoading, isSoloGame };
}
