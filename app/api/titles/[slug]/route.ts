import {revalidateTag} from 'next/cache';
import {NextResponse} from 'next/server';
import {owner,jsonBody,optionalJsonBody,respond} from '@/lib/uploads/http';
import {uploadEngineEnabled} from '@/lib/uploads/config';
import {getUserId} from '@/lib/api/auth';
import {TitleService} from '@/lib/media/title-service';
import {deleteLegacyTitle} from '@/lib/media/legacy-title-writes';
export const dynamic='force-dynamic';
type Context={params:{slug:string}};
export async function GET(req:Request,{params}:Context){return respond(async()=>new TitleService().detail(await owner(req),params.slug));}
export async function PATCH(req:Request,{params}:Context){return respond(async()=>{const result=await new TitleService().edit(await owner(req),params.slug,await jsonBody(req));revalidateTag('peliculas');return result;});}
export async function DELETE(req:Request,{params}:Context){
 // Motor apagado: se conserva el contrato histórico de Windows (DELETE sin cuerpo → 200 {ok:true}).
 if(!uploadEngineEnabled()){
  const userId=await getUserId(req as Parameters<typeof getUserId>[0]);
  if(!userId)return NextResponse.json({error:'No autorizado'},{status:401});
  const result=await deleteLegacyTitle(userId,params.slug);
  if(result.status===200)revalidateTag('peliculas');
  return NextResponse.json(result.body,{status:result.status});
 }
 return respond(async()=>{const result=await new TitleService().lifecycle(await owner(req),params.slug,'delete',await optionalJsonBody(req));revalidateTag('peliculas');return result;},202);
}
