import {
  handlePhotoProtocolRequest,
  PHOTO_PROTOCOL_PRIVILEGES,
  PHOTO_PROTOCOL_SCHEME,
} from '@my-little-garden/photo-handling';
import { protocol } from 'electron';

export function registerPhotoScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PHOTO_PROTOCOL_SCHEME,
      privileges: PHOTO_PROTOCOL_PRIVILEGES,
    },
  ]);
}

export function handlePhotoRequests(photoDirectory: string): void {
  protocol.handle(PHOTO_PROTOCOL_SCHEME, (request) =>
    handlePhotoProtocolRequest(photoDirectory, request.url),
  );
}
