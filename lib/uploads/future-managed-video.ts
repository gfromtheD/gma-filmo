import {StreamProvider,ProviderError} from './stream';
import type {VideoIngestProvider,VideoUploadInspection} from './video-provider';
import type {UploadSession} from './types';
/** Optional managed provider. The R2 installation never constructs this adapter. */
export class FutureManagedVideoProvider implements VideoIngestProvider {
 constructor(readonly stream:StreamProvider){}
 async createUpload(s:UploadSession) {
  if(s.provider_data.provision_started){const ref=await this.stream.recover(s);if(ref)return {providerRef:ref,expiresAt:s.expires_at};throw new ProviderError('UPLOAD_PROVISION_RECOVERY_REQUIRED');}
  return this.stream.provision(s);
 }
 resumeUpload(s:UploadSession){return this.inspectUpload(s);}
 async inspectUpload(s:UploadSession):Promise<VideoUploadInspection> {
  if(!s.provider_ref)throw new ProviderError('UPLOAD_PROVISION_PENDING');
  const received=await this.stream.received(s);return {complete:received===s.expected_input_bytes,receivedBytes:received??0,parts:[]};
 }
 completeUpload(s:UploadSession){return this.inspectUpload(s);}
 verifyObject(s:UploadSession){return this.inspectUpload(s);}
 async cancelUpload(s:UploadSession){if(s.provider_ref)await this.stream.delete(s.provider_ref);}
 async deleteObject(s:UploadSession){return s.provider_ref?this.stream.delete(s.provider_ref):false;}
}
