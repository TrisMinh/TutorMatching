import { GatewayClient, GatewayError, type AuthSessionRepository } from './GatewayClient';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createSession(initial?: { accessToken: string; refreshToken: string }) {
  let value = initial;
  const repository: AuthSessionRepository = {
    clear: vi.fn(() => { value = undefined; }),
    load: vi.fn(() => value),
    save: vi.fn((session) => { value = session; }),
  };
  return repository;
}

describe('GatewayClient', () => {
  it('logs in, stores the token pair, and resolves the current role', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        accessToken: 'access-1',
        accessTokenExpiresAtUtc: '2026-11-14T10:15:00Z',
        refreshToken: 'refresh-1',
        refreshTokenExpiresAtUtc: '2026-11-21T10:00:00Z',
        tokenType: 'Bearer',
      }))
      .mockResolvedValueOnce(jsonResponse({
        userId: '11111111-1111-1111-1111-111111111111',
        email: 'minh@example.com',
        role: 'Student',
      }));
    const session = createSession();
    const client = new GatewayClient({ baseUrl: 'http://gateway.test', fetcher, session });

    const result = await client.login({ email: 'minh@example.com', password: 'secret' }, true);

    expect(result.user.role).toBe('Student');
    expect(session.save).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
      true,
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'http://gateway.test/api/v1/users/me',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer access-1' }) }),
    );
  });

  it('refreshes once after an expired access token and retries the request', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ title: 'Expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({
        accessToken: 'access-2',
        accessTokenExpiresAtUtc: '2026-11-14T10:30:00Z',
        refreshToken: 'refresh-2',
        refreshTokenExpiresAtUtc: '2026-11-21T10:00:00Z',
        tokenType: 'Bearer',
      }))
      .mockResolvedValueOnce(jsonResponse([]));
    const session = createSession({ accessToken: 'expired', refreshToken: 'refresh-1' });
    const client = new GatewayClient({ baseUrl: 'http://gateway.test', fetcher, session });

    await expect(client.listBookings()).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher).toHaveBeenLastCalledWith(
      'http://gateway.test/api/v1/bookings',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer access-2' }) }),
    );
  });

  it('surfaces Problem Details as a stable GatewayError', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      title: 'Slot is no longer available',
      status: 409,
      code: 'SCHEDULING_SLOT_CONFLICT',
      detail: 'Choose another time.',
    }, 409));
    const client = new GatewayClient({
      baseUrl: 'http://gateway.test',
      fetcher,
      session: createSession({ accessToken: 'access', refreshToken: 'refresh' }),
    });

    await expect(client.createBookingHold({
      tutorId: '11111111-1111-1111-1111-111111111111',
      subjectId: '22222222-2222-2222-2222-222222222222',
      startAtUtc: '2026-11-18T03:30:00Z',
    })).rejects.toMatchObject<Partial<GatewayError>>({
      name: 'GatewayError',
      status: 409,
      code: 'SCHEDULING_SLOT_CONFLICT',
      message: 'Choose another time.',
    });
  });

  it('saves student subject interests through the authenticated profile endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new GatewayClient({
      baseUrl: 'http://gateway.test',
      fetcher,
      session: createSession({ accessToken: 'access', refreshToken: 'refresh' }),
    });

    await client.saveStudentInterests([{ subjectId: '22222222-2222-2222-2222-222222222222', priority: 1 }]);

    expect(fetcher).toHaveBeenCalledWith(
      'http://gateway.test/api/v1/students/me/interests',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify([{ subjectId: '22222222-2222-2222-2222-222222222222', priority: 1 }]),
        headers: expect.objectContaining({ Authorization: 'Bearer access' }),
      }),
    );
  });
});
