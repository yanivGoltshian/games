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

export type CommunicationRecordingRequirement =
  | string
  | {
    text: string;
    expectedSrc?: string;
  };

export interface CommunicationContentRequirements {
  contentVersion: string;
  scope: CommunicationGameScope;
  locale: SpeechLocale;
  localeLock: CommunicationLocaleLock;
  recordingKeys: readonly CommunicationRecordingRequirement[];
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
  | 'invalid-recording'
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

function normalizeRecordingRequirement(
  requirement: CommunicationRecordingRequirement,
): { text: string; expectedSrc?: string } {
  return typeof requirement === 'string' ? { text: requirement } : requirement;
}

function recordingRequirementKey(requirement: CommunicationRecordingRequirement): string {
  const normalized = normalizeRecordingRequirement(requirement);
  return `${normalized.text}\u0000${normalized.expectedSrc ?? ''}`;
}

function ownDataProperty(value: object, property: PropertyKey): PropertyDescriptor | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  return descriptor && 'value' in descriptor ? descriptor : undefined;
}

function validateRecordingClip(
  manifest: RecordedSpeechManifest,
  key: string,
  expectedSrc: string | undefined,
): 'missing' | 'invalid' | undefined {
  const entries = manifest.entries as Record<string, unknown>;
  const clipDescriptor = ownDataProperty(entries, key);
  if (!clipDescriptor) {
    return Object.hasOwn(entries, key) ? 'invalid' : 'missing';
  }

  const clip = clipDescriptor.value;
  if (typeof clip !== 'object' || clip === null) {
    return 'invalid';
  }
  if (expectedSrc === undefined) {
    return undefined;
  }

  const srcDescriptor = ownDataProperty(clip, 'src');
  if (!srcDescriptor || srcDescriptor.value !== expectedSrc) {
    return 'invalid';
  }
  return undefined;
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

  const uniqueRecordingRequirements = new Map(
    requirements.recordingKeys.map((requirement) => [
      recordingRequirementKey(requirement),
      normalizeRecordingRequirement(requirement),
    ]),
  );
  for (const recordingRequirement of uniqueRecordingRequirements.values()) {
    const exactKey = recordedSpeechManifestKey(requirements.locale, recordingRequirement.text);
    const validation = validateRecordingClip(
      manifest,
      exactKey,
      recordingRequirement.expectedSrc,
    );
    if (validation === 'missing') {
      issues.push({
        code: 'missing-recording',
        childSafeCode: 'content-unavailable',
        diagnostic: `Missing exact ${requirements.locale} recording ${recordingRequirement.text}.`,
        asset: recordingRequirement.text,
      });
    } else if (validation === 'invalid') {
      issues.push({
        code: 'invalid-recording',
        childSafeCode: 'content-unavailable',
        diagnostic: `Invalid exact ${requirements.locale} recording ${recordingRequirement.text}.`,
        asset: recordingRequirement.text,
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
    loadManifest: () => Promise<RecordedSpeechManifest> = this.loadManifest,
  ): Promise<CommunicationAssetReadiness> {
    try {
      const manifest = await loadManifest();
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
