FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 bubblewrap ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY lib ./lib
COPY scripts/uploads ./scripts/uploads
COPY tsconfig.json ./
RUN useradd --uid 10001 --create-home gma && mkdir -p /work/gma-video && chown -R gma:gma /work
USER gma
ENV VIDEO_SANDBOX=bubblewrap VIDEO_WORK_DIR=/work/gma-video FFMPEG_PATH=/usr/bin/ffmpeg FFPROBE_PATH=/usr/bin/ffprobe VIDEO_PROCESSING_ENABLED=true
CMD ["./node_modules/.bin/tsx", "scripts/uploads/video-worker.ts"]
