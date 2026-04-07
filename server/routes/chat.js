import { Router } from 'express';
import { runAgentTurn } from '../services/llm.js';

const router = Router();

/**
 * Main chat endpoint.
 * Receives the full visible conversation from the frontend and returns:
 * - assistant message
 * - tool call trace
 * - updated durable memory snapshot
 */
router.post('/', async (req, res) => {
  try {
    const { messages = [] } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages must be an array.' });
    }

    const response = await runAgentTurn(messages);
    return res.json(response);
  } catch (error) {
    console.error('Chat route error:', error);
    return res.status(500).json({
      error: 'Chat request failed.',
      detail: error.message,
    });
  }
});

export default router;
