"use client";

import { StepHeading } from "../fields";
import type { StepProps } from "../step-props";
import { VideoDropzone } from "../video-dropzone";

export function VideoStep({ draft, files, showErrors }: StepProps) {
  return (
    <section aria-labelledby="step-video" className="flex flex-col gap-6">
      <div id="step-video"><StepHeading title="Sube tu obra" intro="Empieza por lo principal: tu película o corto. Puedes cambiarlo más adelante, mientras el título siga en borrador." /></div>
      <VideoDropzone slot="video" noun="vídeo" size="large" required file={draft.video.file} files={files} showErrors={showErrors} />
    </section>
  );
}
