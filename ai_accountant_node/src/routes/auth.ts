import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Ledger } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'perfin-dev-secret-change-in-production';
const JWT_EXPIRY = '7d';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export interface JwtPayload {
  userId: number;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Extract user from Authorization header. Returns null if no valid token.
 */
export function getUserFromRequest(req: FastifyRequest): JwtPayload | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

export function authRoutes(app: FastifyInstance, ledger: Ledger): void {
  // ─── Register ───────────────────────────────────────────────────────

  app.post('/api/auth/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const { email, password } = parsed.data;

    // Check if user exists
    const existing = ledger.getUserByEmail(email);
    if (existing) {
      reply.code(409);
      return { error: 'Email already registered' };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = ledger.createUser(email, passwordHash);
    const token = signToken({ userId: user.id, email: user.email });

    reply.code(201);
    return { token, user: { id: user.id, email: user.email } };
  });

  // ─── Login ──────────────────────────────────────────────────────────

  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const { email, password } = parsed.data;
    const user = ledger.getUserByEmail(email);
    if (!user) {
      reply.code(401);
      return { error: 'Invalid email or password' };
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      reply.code(401);
      return { error: 'Invalid email or password' };
    }

    const token = signToken({ userId: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email } };
  });

  // ─── Me — get current user ──────────────────────────────────────────

  app.get('/api/auth/me', async (req, reply) => {
    const u = getUserFromRequest(req);
    if (!u) {
      reply.code(401);
      return { error: 'Unauthorized' };
    }
    const user = ledger.getUserById(u.userId);
    if (!user) {
      reply.code(401);
      return { error: 'User not found' };
    }
    return { id: user.id, email: user.email };
  });
}
