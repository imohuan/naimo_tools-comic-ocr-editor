// Node.js 类型声明
declare module 'fs' {
  export interface Stats {
    isFile(): boolean;
    isDirectory(): boolean;
    size: number;
  }

  export interface promises {
    readdir(path: string): Promise<string[]>;
    readFile(path: string, encoding: string): Promise<string>;
    writeFile(path: string, data: string | Buffer, encoding?: string): Promise<void>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    stat(path: string): Promise<Stats>;
  }
}

declare module 'path' {
  export function join(...paths: string[]): string;
  export function extname(path: string): string;
  export function basename(path: string): string;
}

declare module 'edge-tts-universal' {
  export interface CommunicateOptions {
    voice?: string;
    rate?: string;
    volume?: string;
    pitch?: string;
    proxy?: string;
    connectionTimeout?: number;
  }

  export interface TTSChunk {
    type: "audio" | "WordBoundary";
    data?: Buffer;
    duration?: number;
    offset?: number;
    text?: string;
  }

  export class Communicate {
    constructor(text: string, options?: CommunicateOptions);
    async *stream(): AsyncGenerator<TTSChunk, void, unknown>;
  }
}