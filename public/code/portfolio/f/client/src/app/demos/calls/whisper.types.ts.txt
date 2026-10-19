/** Mensajes entre la página y whisper.worker.ts. */
export type WorkerIn = { type: 'transcribe'; audio: Float32Array; language: 'spanish' | 'english' };

export type WorkerOut =
  | { type: 'download'; loaded: number; total: number }
  | { type: 'transcribing' }
  | { type: 'done'; chunks: { start: number; end: number; text: string }[] }
  | { type: 'error'; message: string };
