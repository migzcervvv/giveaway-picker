const lineBreak = /\r\n|[\n\r\u2028\u2029]/u;

export function splitPaste(text: string): string[] {
  return text.split(lineBreak.test(text) ? lineBreak : /[\t;,]/u);
}

export function looksTabular(text: string): boolean {
  let nonEmpty = 0;
  let tabbed = 0;

  for (const line of text.split(lineBreak)) {
    if (/[^\s\u200B]/u.test(line)) {
      nonEmpty++;
      if (line.includes('\t')) {
        tabbed++;
      }
    }
  }

  return tabbed * 2 > nonEmpty;
}
