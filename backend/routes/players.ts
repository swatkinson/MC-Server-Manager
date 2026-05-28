import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import type { PlayerManager } from '../services/PlayerManager.js';
import type { AuthService } from '../services/AuthService.js';
import { fail, asyncRoute } from './utils.js';

export function createPlayersRouter(
  playerManager: PlayerManager,
  authService: AuthService,
): Router {
  const router = Router();

  router.use(requireAuth(authService));

  router.get(
    '/api/players',
    asyncRoute(async (_req, res) => {
      try {
        const players = await playerManager.getPlayerList();
        res.json({ players });
      } catch (error) {
        fail(res, 500, 'Failed to get player list', error);
      }
    }),
  );

  return router;
}
