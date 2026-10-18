import {UploadError} from '@/lib/uploads/repository';
export function legacyMediaWritesGate(){if((process.env.LEGACY_MEDIA_WRITES_ENABLED??'true')!=='true')throw new UploadError('LEGACY_UPLOAD_DISABLED',410);}
