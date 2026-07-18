import { AzureCliCredential, type AccessToken } from '@azure/identity';

const TOKEN_SCOPE = 'https://cognitiveservices.azure.com/.default';
const REFRESH_WINDOW_MS = 5 * 60_000;

export function createSpeechAuthorizationHeader(
  resourceId: string,
  accessToken: string,
): string {
  if (!resourceId.startsWith('/subscriptions/')) {
    throw new Error('Azure Speech resource ID must be a full Azure resource ID.');
  }
  if (accessToken.length === 0) {
    throw new Error('Azure Speech access token cannot be empty.');
  }
  return `Bearer aad#${resourceId}#${accessToken}`;
}

export interface SpeechTokenCredential {
  getToken(scope: string): Promise<AccessToken | null>;
}

export class SpeechTokenProvider {
  private token: AccessToken | undefined;
  private refreshPromise: Promise<AccessToken> | null = null;

  constructor(private readonly credential: SpeechTokenCredential = new AzureCliCredential()) {}

  async getAccessToken(): Promise<AccessToken> {
    if (this.token && this.token.expiresOnTimestamp >= Date.now() + REFRESH_WINDOW_MS) {
      return this.token;
    }

    if (!this.refreshPromise) {
      this.refreshPromise = this.credential.getToken(TOKEN_SCOPE).then((token) => {
        if (!token) {
          throw new Error('Azure CLI did not return a Cognitive Services access token.');
        }
        this.token = token;
        return token;
      }).finally(() => {
        this.refreshPromise = null;
      });
    }

    return this.refreshPromise;
  }
}
