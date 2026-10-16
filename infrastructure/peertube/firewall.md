# Firewall futuro — ejecutar únicamente en VPS PHASE
Permitir 443/80 para el dominio de vídeo y SSH exclusivamente desde las IP administrativas autorizadas. Denegar entrada a 4319, 9000, 5432, 6379 y cualquier puerto de ingestión/RTMP. PostgreSQL/Redis/PeerTube/gateway escuchan en loopback; el proxy es el único ingreso público. Verificar también IPv6 y publicaciones Docker. Tracker/P2P, signup, federation e import remoto permanecen desactivados. No hay comandos de instalación o reglas aplicadas en esta fase.


## Laboratorio privado propuesto — sin reglas aplicadas

EX-VPS-PRIVATE-01 requiere aprobación, hostindependiente y plan de recuperación antes de cualquier regla. Para esta etapa **NO abrir80/443**; conservar22 existente antes de denegar nuevos ingresos, no restringir su origen sin CIDR/recovery comprobados. PeerTube9000, gateway y PG/Redis solo loopback; acceso por túnelSSH expresamente autorizado. ValidarIPv6 y segunda sesión. No `ufw reset`, cambio de puerto ni cierre root/password incidental. La política pública anterior corresponde a V.5 y requiere dominio/seguridad/permiso posteriores. Ver `docs/media/V2-PREPARACION-PRIVADA.md`.
