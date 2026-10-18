import {draftDTOSchema} from './dto';
import {z} from 'zod';
import {MediaRepository} from './repository';
import {canonicalRequestHash} from './idempotency';
import {metadataSchema,revisionSchema,uuid} from '@/lib/uploads/contracts';
import {UploadError} from '@/lib/uploads/repository';
import type {FichaRepository} from './ficha-repository';
export const publishTitleSchema=z.object({draft_id:uuid,revision:revisionSchema,main_media_id:uuid}).strict();
export const titleLifecycleSchema=z.object({revision:revisionSchema,idempotency_key:uuid}).strict();
export const editTitleSchema=z.object({revision:revisionSchema,metadata:metadataSchema}).strict();
const titleRowSchema=z.object({id:z.number().int().positive(),slug:z.string(),status:z.string().nullable().optional(),media_revision:z.number().int().nonnegative(),media_delete_state:z.enum(['none','pending','done'])}).passthrough();
export function mapTitleDTO(raw:unknown) {
 const row=titleRowSchema.parse(raw);return {id:row.id,slug:row.slug,status:row.status??'published',mediaRevision:row.media_revision,deletionState:row.media_delete_state};
}
export class TitleService {
 constructor(readonly repo=new MediaRepository(),readonly fichas?:Pick<FichaRepository,'publish'>){}
 async publish(owner:string,body:unknown) {
   const input=publishTitleSchema.parse(body);const draft=await this.repo.draft(owner,input.draft_id);
   const raw=await this.repo.uploadCommand(owner,'publish',{...input,request_hash:canonicalRequestHash({draft_id:draft.id,main_media_id:input.main_media_id,metadata:draft.metadata})});
   const title=mapTitleDTO(raw);
   if(!this.fichas)return {title};
   // La ficha completa (Windows) se copia después de publicar: si falla, el título ya existe y la copia es reintentable e idempotente.
   try{const copied=await this.fichas.publish(owner,draft.id);return {title,ficha:{copied:copied.copied}};}
   catch{return {title,ficha:{copied:false,retryable:true}};}
 }
 async detail(owner:string,slug:string) {
   const row=await this.repo.title(slug,owner);
   return {title:{...mapTitleDTO(row),metadata:draftDTOSchema.shape.metadata.parse({title:row.title,synopsis:row.synopsis??null,...(row.year?{year:row.year}:{}),...(row.language?{language:row.language}:{}),...(row.genre?{genre:row.genre}:{})})}};
 }
 async edit(owner:string,slug:string,body:unknown) {
   const input=editTitleSchema.parse(body);return {title:mapTitleDTO(await this.repo.uploadCommand(owner,'edit_title',{...input,slug}))};
 }
 async lifecycle(owner:string,slug:string,action:'unpublish'|'republish'|'delete',body:unknown) {
   const input=titleLifecycleSchema.parse(body);const row=await this.repo.title(slug,owner);const id=z.number().int().positive().parse(row.id);
   const raw=await this.repo.titleCommand(owner,action,{title_id:id,expected_revision:input.revision,idempotency_key:input.idempotency_key,
     request_hash:canonicalRequestHash({title_id:id,action,revision:input.revision})});
   if(action==='delete') {
     const result=z.object({title_id:z.number(),status:z.string(),media_delete_state:z.enum(['none','pending','done'])}).parse(raw);
     if(result.title_id!==id)throw new UploadError('UPLOAD_NOT_FOUND',404);
     return {title:{id,slug,status:result.status,mediaRevision:input.revision+1,deletionState:result.media_delete_state},accepted:true};
   }
   return {title:mapTitleDTO(raw)};
 }
}
