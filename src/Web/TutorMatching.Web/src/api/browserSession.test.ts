import { authSessionKey, browserSession } from './browserSession';

describe('browserSession', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('keeps a remembered session persistent when refreshed tokens are saved', () => {
    browserSession.save({ accessToken: 'access-1', refreshToken: 'refresh-1', role: 'Student' }, true);
    browserSession.save({ accessToken: 'access-2', refreshToken: 'refresh-2', role: 'Student' });

    expect(window.sessionStorage.getItem(authSessionKey)).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(authSessionKey) ?? '{}')).toMatchObject({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      role: 'Student',
    });
  });
});
