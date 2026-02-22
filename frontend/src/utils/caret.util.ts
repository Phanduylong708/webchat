/**
 * Inserts the given text at the current caret selection of a textarea element.
 *
 * This helper is intentionally DOM-focused and returns the computed value and
 * caret range so controlled components can:
 *   1) Call insertTextAtCaret(textareaRef.current, emoji)
 *   2) Use the returned `value` to update React state
 *   3) After state update, assign `selectionStart/selectionEnd` back to the
 *      textarea element (e.g. in an effect or immediately when safe)
 */
export function insertTextAtCaret(
  textarea: HTMLTextAreaElement,
  textToInsert: string
): { value: string; selectionStart: number; selectionEnd: number } {
  const currentValue = textarea.value ?? "";
  let start = textarea.selectionStart ?? currentValue.length;
  let end = textarea.selectionEnd ?? start;

  // Normalize selection so start <= end to handle reversed selections
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const before = currentValue.slice(0, start);
  const after = currentValue.slice(end);

  const nextValue = `${before}${textToInsert}${after}`;
  const nextCaret = start + textToInsert.length;

  return {
    value: nextValue,
    selectionStart: nextCaret,
    selectionEnd: nextCaret,
  };
}
