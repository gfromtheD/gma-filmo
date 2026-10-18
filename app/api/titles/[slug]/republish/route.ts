import {revalidateTag} from 'next/cache';
import {owner,jsonBody,respond} from '@/lib/uploads/http';
import {TitleService} from '@/lib/media/title-service';
export async function POST(req:Request,{params}:{params:{slug:string}}){return respond(async()=>{const result=await new TitleService().lifecycle(await owner(req),params.slug,'republish',await jsonBody(req));revalidateTag('peliculas');return result;});}
