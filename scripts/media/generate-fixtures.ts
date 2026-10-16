import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(process.cwd(), 'tests/media/fixtures/hls');
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH ?? 'ffprobe';
const seconds = 12;

async function main(): Promise<void> {
  await rm(root, { recursive: true, force: true });
  await mkdir(path.join(root, 'v0'), { recursive: true });
  await mkdir(path.join(root, 'v1'), { recursive: true });
  const video = `testsrc2=size=1280x720:rate=30:duration=${seconds}`;
  const audio = `sine=frequency=440:sample_rate=48000:duration=${seconds}`;
  execFileSync(ffmpeg, ['-hide_banner','-loglevel','error','-fflags','+bitexact','-f','lavfi','-i',video,'-f','lavfi','-i',audio,'-t',String(seconds),
    '-c:v','libx264','-threads:v','1','-preset','ultrafast','-b:v','550k','-maxrate','700k','-bufsize','1100k','-pix_fmt','yuv420p','-profile:v','main','-g','60','-sc_threshold','0',
    '-c:a','aac','-threads:a','1','-b:a','64k','-metadata','creation_time=2020-01-01T00:00:00Z','-movflags','+faststart','-shortest',path.join(root,'legacy.mp4')], { stdio: 'inherit' });
  execFileSync(ffmpeg, ['-hide_banner','-loglevel','error','-fflags','+bitexact','-f','lavfi','-i',video,'-f','lavfi','-i',audio,'-t',String(seconds),
    '-filter_complex','[0:v]split=2[v0][v1];[v0]scale=854:480[v480];[v1]scale=1280:720[v720]',
    '-map','[v480]','-map','1:a:0','-map','[v720]','-map','1:a:0','-c:v','libx264','-threads:v','1','-preset','ultrafast','-pix_fmt','yuv420p',
    '-profile:v','main','-g','60','-sc_threshold','0','-b:v:0','350k','-maxrate:v:0','450k','-bufsize:v:0','700k',
    '-b:v:1','900k','-maxrate:v:1','1100k','-bufsize:v:1','1800k','-c:a','aac','-threads:a','1','-b:a','64k','-ar','48000','-ac','2',
    '-metadata','creation_time=2020-01-01T00:00:00Z','-f','hls',
    '-hls_time','4','-hls_playlist_type','vod','-hls_segment_type','fmp4','-hls_fmp4_init_filename','init_%v.mp4',
    '-hls_segment_filename',path.join(root,'v%v','segment_%03d.m4s'),'-master_pl_name','master.m3u8',
    '-var_stream_map','v:0,a:0 v:1,a:1',path.join(root,'v%v','index.m3u8')], { stdio: 'inherit' });
  execFileSync(ffmpeg, ['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=1280x720:rate=1','-frames:v','1',
    path.join(root,'poster.png')], { stdio: 'inherit' });
  const posterPng = await readFile(path.join(root,'poster.png'));
  await sharp(posterPng).webp({ quality: 82 }).toFile(path.join(root,'poster.webp'));
  await rm(path.join(root,'poster.png'));
  await writeFile(path.join(root,'subtitles.es.vtt'), 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nSubtítulo de prueba\n\n00:00:05.000 --> 00:00:08.000\nSegundo cue\n');
  await writeFile(path.join(root,'subtitles.en.vtt'), 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nTest subtitle\n\n00:00:05.000 --> 00:00:08.000\nSecond cue\n');
  const probe = JSON.parse(execFileSync(ffprobe, ['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',
    path.join(root,'legacy.mp4')], { encoding: 'utf8' })) as { format?: { duration?: string }; streams?: Array<{ codec_type?: string }> };
  const duration = Number(probe.format?.duration);
  if (!Number.isFinite(duration) || Math.abs(duration-seconds)>0.25 || !probe.streams?.some((stream)=>stream.codec_type==='video')
    || !probe.streams.some((stream)=>stream.codec_type==='audio')) throw new Error('Generated MP4 is missing audio/video or expected duration');
  for (const playlist of ['master.m3u8','v0/index.m3u8','v1/index.m3u8']) {
    execFileSync(ffmpeg, ['-hide_banner','-loglevel','error','-i',path.join(root,playlist),'-f','null','-'], { stdio: 'inherit' });
  }
  const entries: string[] = [];
  for (const file of await walk(root)) {
    const body = await readFile(path.join(root,file));
    entries.push(`${createHash('sha256').update(body).digest('hex')}  ${file}`);
  }
  await writeFile(path.join(root,'SHA256SUMS'), `${entries.sort().join('\n')}\n`);
  const size = await directoryBytes(root);
  if (size > 10 * 1024 * 1024) throw new Error(`Media fixtures exceed 10 MiB (${size} bytes)`);
  console.log(`Generated and decoded ${seconds}s MP4 + two-rendition HLS fixture: ${size} bytes`);
}

async function walk(directory: string, prefix = ''): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path.join(directory,entry.name),relative));
    else if (entry.isFile() && entry.name !== 'SHA256SUMS') result.push(relative);
  }
  return result;
}
async function directoryBytes(directory: string): Promise<number> {
  return (await Promise.all((await walk(directory)).map(async (name) => (await readFile(path.join(directory,name))).byteLength))).reduce((a,b)=>a+b,0);
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
