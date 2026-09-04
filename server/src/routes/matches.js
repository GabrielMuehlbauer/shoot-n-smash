import { Router } from 'express';

export function createMatchesRouter({ matchService }) {
  if (
    typeof matchService?.submit !== 'function' ||
    typeof matchService?.ranking !== 'function'
  ) {
    throw new TypeError('A rota de partidas requer um MatchService válido.');
  }

  const router = Router();

  router.post('/partidas', async (request, response, next) => {
    try {
      const result = await matchService.submit(request.body);
      response.status(result.created ? 201 : 200).json({
        duplicada: !result.created,
        partida: result.match,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/ranking', async (request, response, next) => {
    try {
      response.json(await matchService.ranking(request.query));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
