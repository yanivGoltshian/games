import { describe, expect, it } from 'vitest';
import {
  createSpeechAuthorizationHeader,
  SpeechTokenProvider,
  type SpeechTokenCredential,
} from './speechAuthorization.js';

describe('Azure speech authorization', () => {
  it('binds Microsoft Entra tokens to the exact Speech resource', () => {
    expect(createSpeechAuthorizationHeader(
      '/subscriptions/example/resourceGroups/speech/providers/Microsoft.CognitiveServices/accounts/story',
      'fake-access-token',
    )).toBe(
      'Bearer aad#/subscriptions/example/resourceGroups/speech/providers/Microsoft.CognitiveServices/accounts/story#fake-access-token',
    );
  });

  it('rejects incomplete resource IDs and empty access tokens', () => {
    expect(() => createSpeechAuthorizationHeader('story', 'token')).toThrow(
      'full Azure resource ID',
    );
    expect(() => createSpeechAuthorizationHeader(
      '/subscriptions/example/resourceGroups/speech/providers/Microsoft.CognitiveServices/accounts/story',
      '',
    )).toThrow('cannot be empty');
  });

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
