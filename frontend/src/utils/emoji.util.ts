import { parse } from "twemoji-parser";
import { createElement } from "react";
import type { CSSProperties, ReactNode } from "react";

export type EmojiToken =
  | { kind: "text"; value: string }
  | { kind: "emoji"; value: string; url: string };

/**
 * Tokenizes a message string into text and emoji segments using twemoji-parser.
 * The returned tokens preserve the original ordering of content.
 */
export function tokenizeEmojiContent(content: string): EmojiToken[] {
  if (!content) {
    return [];
  }

  const parsed = parse(content);

  if (!parsed || parsed.length === 0) {
    return [{ kind: "text", value: content }];
  }

  const tokens: EmojiToken[] = [];
  let lastIndex = 0;

  for (const emoji of parsed) {
    const indices = emoji.indices as [number, number] | undefined;
    const start = indices?.[0] ?? 0;
    const end = indices?.[1] ?? 0;

    if (start > lastIndex) {
      tokens.push({
        kind: "text",
        value: content.slice(lastIndex, start),
      });
    }

    tokens.push({
      kind: "emoji",
      value: emoji.text,
      url: emoji.url,
    });

    lastIndex = end;
  }

  if (lastIndex < content.length) {
    tokens.push({
      kind: "text",
      value: content.slice(lastIndex),
    });
  }

  return tokens;
}

/**
 * Computes whether a tokenized message is effectively "all emoji" and,
 * if so, which size tier should be used for rendering.
 */
export function getEmojiSizing(tokens: EmojiToken[]): {
  isAllEmoji: boolean;
  sizePx: number | null;
} {
  if (!tokens.length) {
    return { isAllEmoji: false, sizePx: null };
  }

  let emojiCount = 0;
  let hasNonWhitespaceText = false;

  for (const token of tokens) {
    if (token.kind === "emoji") {
      emojiCount += 1;
    } else if (token.value.trim().length > 0) {
      hasNonWhitespaceText = true;
      break;
    }
  }

  const isAllEmoji = emojiCount > 0 && !hasNonWhitespaceText;

  if (!isAllEmoji) {
    return { isAllEmoji: false, sizePx: null };
  }

  let sizePx: number;
  if (emojiCount === 1) sizePx = 52;
  else if (emojiCount === 2) sizePx = 44;
  else if (emojiCount === 3) sizePx = 36;
  else sizePx = 28;

  return { isAllEmoji, sizePx };
}

/**
 * Renders emoji tokens as Twemoji <img> nodes and text tokens as plain strings.
 * For mixed text+emoji content, emojis default to approximately 1em to align
 * with surrounding text; for all-emoji content, sizePx can be used to apply
 * the larger tiers specified in the PRD.
 */
export function renderTwemojiTokens(
  tokens: EmojiToken[],
  options?: { sizePx?: number | null }
): ReactNode[] {
  const nodes: ReactNode[] = [];

  if (!tokens.length) {
    return nodes;
  }

  const pixelSize = options?.sizePx ?? null;
  const size: CSSProperties["width"] = pixelSize ?? "1em";
  const style: CSSProperties = {
    width: size,
    height: size,
  };

  tokens.forEach((token, index) => {
    if (token.kind === "text") {
      if (token.value.length > 0) {
        nodes.push(token.value);
      }
      return;
    }

    nodes.push(
      createElement("img", {
        key: `emoji-${index}`,
        src: token.url,
        alt: token.value,
        draggable: false,
        loading: "lazy",
        className: "inline-block align-middle",
        style,
      })
    );
  });

  return nodes;
}

