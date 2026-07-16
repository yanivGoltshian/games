import { describe, expect, it } from 'vitest';
import { SpeechTokenProvider, type SpeechTokenCredential } from './speechAuthorization.js';

describe('Azure speech authorization', () => {
  it('shares one Azure CLI token refresh across concurrent synthesis requests', async () => {
    let tokenRequests = 0;
    const credential: SpeechTokenCredential = {
      getToken: async () => {
        tokenRequests += 1;
        await Promise.resolve();
        return {
          token: 'fake-access-token',
          expiresOnTimestamp: Date.now() + 60 * 60_000,
        };
      },
    };
    const tokenProvider = new SpeechTokenProvider(credential);

    const tokens = await Promise.all(
      Array.from({ length: 4 }, () => tokenProvider.getAccessToken()),
    );

    expect(tokenRequests).toBe(1);
    expect(tokens.map((token) => token.token)).toEqual(
      Array.from({ length: 4 }, () => 'fake-access-token'),
    );
  });
});
