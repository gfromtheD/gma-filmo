const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const route = path.join(root, 'app/support-flow-test/page.tsx');
fs.mkdirSync(path.dirname(route), { recursive: true });
fs.writeFileSync(route, `"use client";
import { useSearchParams } from "next/navigation";
import { PlayerScreen } from "@/components/features/player/player-screen";
import { CreatorProfilePage } from "@/components/features/creator/creator-profile";
import { CreatorSupportPage } from "@/components/features/creator/creator-support-page";
const creator = { slug: "test-director", nombre: "Directora de prueba", foto_perfil: null, imagen_portada: null, nacionalidad: null, bio: "Presentación de prueba", redes_sociales: [], donacion_paypal: "https://paypal.me/testdirector", donacion_patreon: "https://patreon.com/testdirector", donacion_bitcoin: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", titulos: ["test-short"] };
const item = { kind: "movie" as const, id: "test-short", numericId: 1, title: "Corto de prueba", year: 2026, rating: "TP", categories: [], genre: "Cortometraje", synopsis: "", runtime: "30 s", r2VideoUrl: "http://127.0.0.1:3218/__support-video.mp4", style: { tone: ["#000", "#111"] as const, accent: "#22B16B", motif: "ring" as const } };
export default function Fixture() { const params = useSearchParams(); const record = params.get("empty") ? { ...creator, donacion_paypal: null, donacion_patreon: null, donacion_bitcoin: null } : creator; const selected = params.get("youtube") ? { ...item, r2VideoUrl: undefined, videoUrl: "https://www.youtube.com/watch?v=test-video" } : item; return params.get("profile") ? <CreatorProfilePage creator={record} films={[item]} /> : params.get("mobile") ? <CreatorSupportPage creator={record} /> : <PlayerScreen item={selected} creator={record} nextItem={{...item, id: "next-short"}} nextUrl="/support-flow-test?next=1" />; }
`);
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3218'], { cwd: root, stdio: 'inherit' });
function cleanup() { fs.rmSync(path.dirname(route), { recursive: true, force: true }); }
process.on('SIGTERM', () => { cleanup(); server.kill('SIGTERM'); });
process.on('SIGINT', () => { cleanup(); server.kill('SIGINT'); });
server.on('exit', code => { cleanup(); process.exit(code ?? 0); });
