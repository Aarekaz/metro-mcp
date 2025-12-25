import { Env } from './types';
import { Router } from './router';

const router = new Router();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return router.handleRequest(request, env);
  }
};