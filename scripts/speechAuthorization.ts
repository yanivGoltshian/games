import { AzureCliCredential, type AccessToken } from '@azure/identity';

const TOKEN_SCOPE = 'https://cognitiveservices.azure.com/.default';
const REFRESH_WINDOW_MS = 5 * 60_000;

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
