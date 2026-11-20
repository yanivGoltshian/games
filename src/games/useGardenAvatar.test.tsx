// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishFamilyPhotoLibraryChange } from '../services/familyPhotoLibraryEvents';
import { getFamilyPhoto } from '../services/familyPhotoStorage';
import { useGardenAvatar } from './useGardenAvatar';

vi.mock('../services/familyPhotoStorage', () => ({ getFamilyPhoto: vi.fn() }));

describe('device-local Garden avatar override', () => {
  const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let container: HTMLDivElement;
  let root: Root;
  const decode = vi.fn<() => Promise<void>>();
  const revoke = vi.fn();

  function Probe({ id }: { id: string }) {
    return <span>{useGardenAvatar(id) ?? 'bundled'}</span>;
  }

  beforeEach(() => {
    env.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
    decode.mockReset();
    revoke.mockReset();
    vi.stubGlobal('Image', class { decode() { return decode(); } });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:synthetic', revokeObjectURL: revoke });
    vi.mocked(getFamilyPhoto).mockReset();
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    delete env.IS_REACT_ACT_ENVIRONMENT;
  });

  const photo = {
    id: 'local',
    blob: new Blob(['synthetic'], { type: 'image/jpeg' }),
    mimeType: 'image/jpeg' as const,
    byteSize: 9,
    width: 32,
    height: 32,
    createdAt: 0,
  };
  const render = async (id: string) => {
    await act(async () => root.render(<Probe id={id} />));
  };

  it('uses the override only after decoding and revokes it on deletion', async () => {
    vi.mocked(getFamilyPhoto).mockResolvedValue(photo);
    let decoded!: () => void;
    decode.mockImplementation(() => new Promise<void>((resolve) => { decoded = resolve; }));
    await render('local');
    expect(container.textContent).toBe('bundled');
    await act(async () => decoded());
    expect(container.textContent).toBe('blob:synthetic');
    await act(async () => publishFamilyPhotoLibraryChange({ kind: 'deleted', id: 'local' }));
    expect(container.textContent).toBe('bundled');
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:synthetic');
  });

  it('keeps the default for an unreadable override and releases the failed URL', async () => {
    vi.mocked(getFamilyPhoto).mockResolvedValue(photo);
    decode.mockRejectedValue(new Error('invalid image'));
    await render('local');
    expect(container.textContent).toBe('bundled');
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:synthetic');
  });
});
