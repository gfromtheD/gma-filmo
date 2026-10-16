import {revalidateTag} from 'next/cache';
import {owner,jsonBody,respond,engineGate} from '@/lib/uploads/http';
import {uploadEngineEnabled} from '@/lib/uploads/config';
import {legacyMediaWritesGate} from '@/lib/media/legacy-writes';
import {TitleService} from '@/lib/media/title-service';
import {FichaRepository} from '@/lib/media/ficha-repository';
export async function POST(req:Request){return respond(async()=>{
 if(!uploadEngineEnabled()){legacyMediaWritesGate();const user=await owner(req);return (await import('@/lib/media/legacy-title-writes')).publishLegacyTitle(user,await jsonBody(req));}
 engineGate(true);const result=await new TitleService(undefined,new FichaRepository()).publish(await owner(req),await jsonBody(req));revalidateTag('peliculas');return result;
},201);}
