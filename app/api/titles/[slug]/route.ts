import {revalidateTag} from 'next/cache';
import {owner,jsonBody,respond} from '@/lib/uploads/http';
import {TitleService} from '@/lib/media/title-service';
export const dynamic='force-dynamic';
type Context={params:{slug:string}};
export async function GET(req:Request,{params}:Context){return respond(async()=>new TitleService().detail(await owner(req),params.slug));}
export async function PATCH(req:Request,{params}:Context){return respond(async()=>{const result=await new TitleService().edit(await owner(req),params.slug,await jsonBody(req));revalidateTag('peliculas');return result;});}
export async function DELETE(req:Request,{params}:Context){return respond(async()=>{const result=await new TitleService().lifecycle(await owner(req),params.slug,'delete',await jsonBody(req));revalidateTag('peliculas');return result;},202);}
