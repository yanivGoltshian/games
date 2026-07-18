import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCommunicationLocaleLock,
  type CommunicationGameScope,
} from '../domain/communicationGame';
import { createInitialSettings } from '../domain/progression';
import { storyThatWaitsMediaCoordinator } from './storyThatWaitsMedia';
import { storyThatWaitsRecordedSpeechPlayer } from './storyThatWaitsRecordedSpeech';

const scope: CommunicationGameScope = {
  activityId: 'story-that-waits',
  sessionId: 'production-wiring-test',
  roundId: 'duck-and-ball',
  stepId: 'page-1',
};

describe('Story That Waits production media wiring', () => {
  afterEach(() => {
    storyThatWaitsMediaCoordinator.cancelAll('exit');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses exact recorded playback off Apple and never reaches generic runtime synthesis', async () => {
    const synthesisSpeak = vi.fn();
    vi.stubGlobal('window', {
      speechSynthesis: {
        speak: synthesisSpeak,
        resume: vi.fn(),
        cancel: vi.fn(),
        getVoices: vi.fn(() => []),
      },
    });
    vi.stubGlobal('SpeechSynthesisUtterance', vi.fn(() => {
      throw new Error('Runtime synthesis must never be constructed.');
    }));
    vi.spyOn(storyThatWaitsRecordedSpeechPlayer, 'isEnabled').mockReturnValue(false);
    vi.spyOn(storyThatWaitsRecordedSpeechPlayer, 'unlock').mockResolvedValue();
    const recordedPlay = vi.spyOn(storyThatWaitsRecordedSpeechPlayer, 'play').mockImplementation(async (options) => {
      options.onStart();
    });

    storyThatWaitsMediaCoordinator.unlock();
    const outcome = await storyThatWaitsMediaCoordinator.play({
      intentId: 'story-that-waits:production-wiring-test:page-1',
      source: 'touch',
      scope,
      audioClass: 'mandatory',
      settings: { ...createInitialSettings(), quietMode: false },
      localeLock: createCommunicationLocaleLock(scope, 'en-GB', 'session'),
      segments: [{
        text: 'The bus rests beside the flower.',
        recordedText: 'The bus rests beside the flower.',
        locale: 'en-GB',
      }],
    });

    expect(outcome).toMatchObject({ status: 'completed' });
    expect(storyThatWaitsRecordedSpeechPlayer.isEnabled).not.toHaveBeenCalled();
    expect(recordedPlay).toHaveBeenCalledWith(expect.objectContaining({
      text: 'The bus rests beside the flower.',
      locale: 'en-GB',
    }));
    expect(synthesisSpeak).not.toHaveBeenCalled();
  });
});
