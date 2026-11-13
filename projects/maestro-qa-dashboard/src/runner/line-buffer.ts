export function createLineBuffer(onLine: (line: string) => void) {
  let buffer = "";
  const emit = (chunk: string) => {
    const normalized = chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    buffer += normalized;
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) onLine(line);
  };
  return {
    push: emit,
    flush() {
      if (!buffer) return;
      onLine(buffer);
      buffer = "";
    },
  };
}
