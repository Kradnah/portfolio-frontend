/**
 * Lo que digo en el video (Whisper large-v3-turbo, revisado a mano: nombres propios corregidos).
 * De aquí salen la transcripción de la página y los subtítulos de /intro/intro.en.vtt.
 */
export interface Cue {
  start: number;
  end: number;
  text: string;
}

export const CUES: Cue[] = [
  { start: 0, end: 5.94, text: "Hi, I'm Julian, a full-stack developer from Colombia with more" },
  { start: 5.94, end: 10.68, text: "than four years of experience, and I think I'm a strong fit for this role because" },
  { start: 10.68, end: 14.32, text: 'Claude Code is already my main development tool.' },
  { start: 14.76, end: 20.24, text: 'I take an idea, plan it with Claude, build it, test it, and ship it, usually much' },
  { start: 20.24, end: 22.0, text: 'faster than I could do it before.' },
  { start: 22.0, end: 27.52, text: 'You can see this in my portfolio at julian-lizcano.com.' },
  { start: 27.72, end: 32.38, text: 'It has three demos: a call analyzer that transcribes audio in the browser and' },
  { start: 32.38, end: 38.04, text: 'scores the call with an LLM, an invoice validator that reads PDFs and images' },
  { start: 38.04, end: 44.9, text: 'using OCR, and a real computer vision demo using the webcam.' },
  { start: 45.2, end: 51.1, text: 'There is also a code viewer, so you can read all the source code without asking for access.' },
  { start: 51.1, end: 57.08, text: 'The portfolio uses TypeScript and Angular on the front end and Python FastAPI on' },
  { start: 57.08, end: 62.8, text: 'the back end, deployed with Docker on my own VPS. I have worked' },
  { start: 62.8, end: 68.1, text: "with React, NestJS and PostgreSQL, and I've deployed on" },
  { start: 68.1, end: 69.88, text: 'Vercel.' },
  { start: 69.88, end: 74.9, text: "I build faster with AI, but I don't trust it blindly. I test everything in" },
  { start: 74.9, end: 79.04, text: 'production, and I find the real cause before I ship a fix.' },
  { start: 79.46, end: 85.46, text: "I'm comfortable owning a project from start to finish, and I think that's" },
  { start: 85.46, end: 89.8, text: 'it. Thank you, I would love to build with you.' },
];
