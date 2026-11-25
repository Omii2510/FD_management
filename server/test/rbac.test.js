import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';

import { restrictTo } from '../src/middleware/auth.middleware.js';
import { requireBankOwnership } from '../src/middleware/bankOwnership.middleware.js';
import { preventRoleAssignment, requireSelf, requireUser } from '../src/middleware/authorization.middleware.js';

const runMiddleware = (middleware, req) => new Promise((resolve) => {
  let settled = false;
  const res = {};
  const finish = (error) => {
    if (!settled) {
      settled = true;
      resolve(error);
    }
  };
  middleware(req, res, finish);
});

describe('Phase 4 RBAC and ownership middleware', () => {
  it('allows only configured roles', async () => {
    const allowed = await runMiddleware(
      restrictTo('admin'),
      { user: { role: 'admin' } }
    );
    expect(allowed).toBeUndefined();

    const forbidden = await runMiddleware(
      restrictTo('admin'),
      { user: { role: 'bank' } }
    );
    expect(forbidden.statusCode).toBe(403);
  });

  it('blocks a bank user from another bank resource', async () => {
    const bankA = new mongoose.Types.ObjectId();
    const bankB = new mongoose.Types.ObjectId();
    const error = await runMiddleware(
      requireBankOwnership(bankB),
      { user: { role: 'bank', bankId: bankA } }
    );
    expect(error.statusCode).toBe(403);
  });

  it('allows a bank user to access its own bank resource', async () => {
    const bankId = new mongoose.Types.ObjectId();
    const error = await runMiddleware(
      requireBankOwnership(bankId),
      { user: { role: 'bank', bankId } }
    );
    expect(error).toBeUndefined();
  });

  it('restricts bank and admin APIs from normal users', async () => {
    const error = await runMiddleware(requireUser, { user: { role: 'admin' } });
    expect(error.statusCode).toBe(403);
  });

  it('blocks cross-user resource access', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const otherId = new mongoose.Types.ObjectId();
    const error = await runMiddleware(
      requireSelf(() => otherId),
      { user: { _id: ownerId, role: 'user' } }
    );
    expect(error.statusCode).toBe(403);
  });

  it('rejects role and privilege fields in public profile updates', async () => {
    const error = await runMiddleware(
      preventRoleAssignment,
      { body: { fullName: 'Test', role: 'admin', bankId: 'attacker-value' } }
    );
    expect(error.statusCode).toBe(403);
  });
});
