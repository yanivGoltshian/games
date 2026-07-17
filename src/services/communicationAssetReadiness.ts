import {
  localeLockMatches,
  type CommunicationGameScope,
  type CommunicationLocaleLock,
} from '../domain/communicationGame';
import type { SpeechLocale } from '../domain/types';
import {
  recordedSpeechManifestKey,
  recordedSpeechPlayer,
  type RecordedSpeechManifest,
} from './recordedSpeech';

export type CommunicationImageAsset =
  | { kind: 'id'; value: string }
  | { kind: 'url'; value: string };

export interface CommunicationContentRequirements {
  contentVersion: string;
  scope: CommunicationGameScope;
  locale: SpeechLocale;
  localeLock: CommunicationLocaleLock;
  recordingKeys: readonly string[];
  images: readonly CommunicationImageAsset[];
}

export interface InstalledCommunicationContent {
  contentVersion: string;
  images: readonly CommunicationImageAsset[];
}

export type CommunicationReadinessIssueCode =
  | 'content-version-mismatch'
  | 'locale-mismatch'
  | 'missing-recording'
  | 'missing-image'
  | 'catalog-unavailable';

export interface CommunicationReadinessIssue {
  code: CommunicationReadinessIssueCode;
  childSafeCode: 'content-unavailable';
  diagnostic: string;
  asset?: string;
}

export type CommunicationAssetReadiness =
  | {
    status: 'ready';
    contentVersion: string;
    locale: SpeechLocale;
  }
  | {
    status: 'not-ready';
    contentVersion: string;
    locale: SpeechLocale;
    issues: CommunicationReadinessIssue[];
  };

function imageKey(image: CommunicationImageAsset): string {
  return `${image.kind}:${image.value}`;
}

export function validateCommunicationAssetReadiness(
  requirements: CommunicationContentRequirements,
  installed: InstalledCommunicationContent,
  manifest: RecordedSpeechManifest,
): CommunicationAssetReadiness {
  const issues: CommunicationReadinessIssue[] = [];
  if (requirements.contentVersion !== installed.contentVersion) {
    issues.push({
      code: 'content-version-mismatch',
      childSafeCode: 'content-unavailable',
      diagnostic: `Expected content ${requirements.contentVersion}, installed ${installed.contentVersion}.`,
    });
  }
  if (!localeLockMatches(requirements.localeLock, requirements.scope, requirements.locale)) {
    issues.push({
      code: 'locale-mismatch',
      childSafeCode: 'content-unavailable',
      diagnostic: `Locale ${requirements.locale} does not match the locked natural unit.`,
    });
  }

  for (const recordingKey of new Set(requirements.recordingKeys)) {
    const exactKey = recordedSpeechManifestKey(requirements.locale, recordingKey);
    if (!manifest.entries[exactKey]) {
      issues.push({
        code: 'missing-recording',
        childSafeCode: 'content-unavailable',
        diagnostic: `Missing exact ${requirements.locale} recording ${recordingKey}.`,
        asset: recordingKey,
      });
    }
  }

  const installedImages = new Set(installed.images.map(imageKey));
  for (const image of requirements.images) {
    if (!installedImages.has(imageKey(image))) {
      issues.push({
        code: 'missing-image',
        childSafeCode: 'content-unavailable',
        diagnostic: `Missing installed image ${image.kind}:${image.value}.`,
        asset: image.value,
      });
    }
  }

  return issues.length === 0
    ? {
      status: 'ready',
      contentVersion: requirements.contentVersion,
      locale: requirements.locale,
    }
    : {
      status: 'not-ready',
      contentVersion: requirements.contentVersion,
      locale: requirements.locale,
      issues,
    };
}

export class CommunicationAssetReadinessService {
  constructor(
    private readonly loadManifest: () => Promise<RecordedSpeechManifest> =
      () => recordedSpeechPlayer.getManifest(),
  ) {}

  async validate(
    requirements: CommunicationContentRequirements,
    installed: InstalledCommunicationContent,
  ): Promise<CommunicationAssetReadiness> {
    try {
      const manifest = await this.loadManifest();
      return validateCommunicationAssetReadiness(requirements, installed, manifest);
    } catch (error: unknown) {
      const diagnostic = error instanceof Error ? error.message : 'Unknown installed catalog error.';
      return {
        status: 'not-ready',
        contentVersion: requirements.contentVersion,
        locale: requirements.locale,
        issues: [{
          code: 'catalog-unavailable',
          childSafeCode: 'content-unavailable',
          diagnostic,
        }],
      };
    }
  }
}

export const communicationAssetReadiness = new CommunicationAssetReadinessService();
