import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { protocol } from 'electron';

export function registerPhotoScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'garden-photo',
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ]);
}

function photoMediaType(filename: string): string | null {
  if (filename.endsWith('.jpg')) {
    return 'image/jpeg';
  }
  if (filename.endsWith('.png')) {
    return 'image/png';
  }
  if (filename.endsWith('.webp')) {
    return 'image/webp';
  }
  return null;
}

export function handlePhotoRequests(photoDirectory: string): void {
  protocol.handle('garden-photo', async (request) => {
    const url = new URL(request.url);
    const filename = decodeURIComponent(url.pathname.slice(1));
    const mediaType = photoMediaType(filename);
    if (
      url.hostname !== 'image' ||
      !filename ||
      basename(filename) !== filename ||
      !mediaType
    ) {
      return new Response('Invalid image path', { status: 400 });
    }
    try {
      return new Response(await readFile(join(photoDirectory, filename)), {
        headers: { 'Content-Type': mediaType, 'Cache-Control': 'no-store' },
      });
    } catch {
      return new Response('Image not found', { status: 404 });
    }
  });
}
