import { Router } from 'express';
import { verifyCredentials, createToken } from '../auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  if (!verifyCredentials(username, password)) {
    return res.status(401).json({ error: 'invalid username or password' });
  }
  res.json({ token: createToken(username), username });
});

export default router;
