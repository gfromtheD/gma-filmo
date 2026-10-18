import type {UploadSession} from './types';
export interface ReceivedPart {number: number; size: number; etag: string}
export interface VideoUpload {
  providerRef: string;
  multipartUploadId?: string;
  partSize?: number;
  uploadUrl?: string;
  expiresAt: string;
}
export interface VideoUploadInspection {
  parts: ReceivedPart[];
  complete: boolean;
  receivedBytes: number;
  etag?: string;
}
/** Domain contract: no provider SDK types or public URLs are permanent identities. */
export interface VideoIngestProvider {
  createUpload(session: UploadSession): Promise<VideoUpload>;
  resumeUpload(session: UploadSession): Promise<VideoUploadInspection>;
  inspectUpload(session: UploadSession): Promise<VideoUploadInspection>;
  completeUpload(session: UploadSession): Promise<VideoUploadInspection>;
  cancelUpload(session: UploadSession): Promise<void>;
  verifyObject(session: UploadSession): Promise<VideoUploadInspection>;
  deleteObject(session: UploadSession): Promise<boolean>;
  signPart?(session:UploadSession,number:number):Promise<{number:number;size:number;url:string;expiresAt:number}>;
  deletePrefix?(prefix:string):Promise<void>;
  cleanupIngest?(session:UploadSession):Promise<void>;
}
