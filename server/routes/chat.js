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

    // Guard against oversized conversations inflating API cost on the public demo.
    const MAX_MESSAGES = 40;
    const MAX_CONTENT_CHARS = 8000;
    if (messages.length > MAX_MESSAGES) {
      return res.status(400).json({ error: `Conversation too long (max ${MAX_MESSAGES} messages).` });
    }
    if (messages.some((m) => typeof m?.content === 'string' && m.content.length > MAX_CONTENT_CHARS)) {
      return res.status(400).json({ error: `Message too long (max ${MAX_CONTENT_CHARS} characters).` });
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
