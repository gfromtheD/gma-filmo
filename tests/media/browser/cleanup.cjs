const fs=require('node:fs');
module.exports=()=>{
  for(const [dir,marker,file] of [['app/creadores/media-player-fixture','export default function PlayerFixture','page.tsx'],['app/api/media/player-test-fixture/[...path]','// Local generated fixture only.','route.ts'],['app/api/titles/media-player-fixture/playback','// Local generated fixture only.','route.ts']]) {
    if(fs.existsSync(dir+'/'+file)) {if(!fs.readFileSync(dir+'/'+file,'utf8').includes(marker)) throw Error('Unexpected fixture contents');fs.rmSync(dir,{recursive:true});}
  }
  for(const dir of ['app/api/media/player-test-fixture','app/api/titles/media-player-fixture']) if(fs.existsSync(dir)){if(fs.readdirSync(dir).length)throw Error('Unexpected fixture parent contents');fs.rmdirSync(dir);}
  for(const dir of ['.next-player/types/app/creadores/media-player-fixture','.next-player/types/app/api/media/player-test-fixture','.next-player/types/app/api/media/__player-test','.next-player/types/app/api/titles/media-player-fixture']) fs.rmSync(dir,{recursive:true,force:true});
};
