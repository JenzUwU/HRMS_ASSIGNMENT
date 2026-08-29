/**
 * Strip quoted reply history from an inbound email body for DISPLAY ONLY.
 *
 * The stored database message is never changed. This runs when an inbound email
 * message is rendered in the Communication chat so HR sees just the candidate's
 * actual reply, not the Gmail/Outlook quoted thread underneath it.
 *
 * Conservative by design: it only cuts at a recognised quote boundary
 * (attribution line, "Original Message" separator, Outlook divider) or a
 * trailing block that is entirely "> " quoted lines. Leading or embedded
 * "> " text and normal multi-line replies are left untouched.
 */

// Ordered list of "everything from here down is quoted history" markers.
const QUOTE_MARKERS: RegExp[] = [
  // Gmail: "On Sat, Aug 29, 2026, 9:16 PM HR <x@y> wrote:" (may wrap across lines)
  /\n*^On\s[\s\S]{0,600}?\swrote:[ \t]*$/im,
  // Apple Mail / some clients: "> On <date>, <name> wrote:"
  /\n*^>?[ \t]*On\s[\s\S]{0,600}?\swrote:[ \t]*$/im,
  // Outlook / generic separators
  /\n*^-{2,}[ \t]*Original Message[ \t]*-{2,}[ \t]*$/im,
  /\n*^_{5,}[ \t]*$/m,
  // Outlook header block: "From: ...\n...\nSent:/Date: ..."
  /\n*^From:[ \t].+\n(?:.*\n)*?^(?:Sent|Date):[ \t].+$/im,
];

export function cleanInboundEmailBody(body: string): string {
  if (!body) return "";

  const text = body.replace(/\r\n?/g, "\n");

  let cut = text.length;
  for (const re of QUOTE_MARKERS) {
    const m = re.exec(text);
    if (m && m.index < cut) cut = m.index;
  }

  let head = text.slice(0, cut);

  // Also drop a trailing block that is entirely quoted ("> " lines / blanks) -
  // covers replies where the client emitted no attribution line. Only applied
  // when at least one real "> " line is being removed, so a reply that merely
  // ends on a blank line is unaffected.
  const lines = head.split("\n");
  let end = lines.length;
  while (end > 0) {
    const ln = lines[end - 1].trim();
    if (ln === "" || ln.startsWith(">")) {
      end--;
      continue;
    }
    break;
  }
  if (
    end < lines.length &&
    lines.slice(end).some((l) => l.trim().startsWith(">"))
  ) {
    head = lines.slice(0, end).join("\n");
  }

  const cleaned = head.replace(/^\s+|\s+$/g, "");

  // If cleaning removed everything (the whole body was quoted history), fall
  // back to the original trimmed text rather than showing an empty bubble.
  return cleaned.length > 0 ? cleaned : text.trim();
}
