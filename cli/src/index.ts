#!/usr/bin/env node
import { processIo } from "./output.js";
import { run } from "./program.js";

// Stdin is only read for `auth login --token-stdin`.
const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
};

process.exitCode = await run(process.argv, processIo, readStdin);
