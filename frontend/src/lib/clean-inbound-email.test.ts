/**
 * Unit tests for cleanInboundEmailBody. No test framework is installed in this
 * project, so these use the Node built-in test runner:
 *
 *   npm run test:utils
 *   (node --test --experimental-strip-types src/lib/clean-inbound-email.test.ts)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { cleanInboundEmailBody } from "./clean-inbound-email.ts";

test("removes Gmail quoted history (assignment example)", () => {
  const input =
    "Hi HR, Recieved\n\nOn Sat, Aug 29, 2026, 9:16 PM HR <taetaechim02@gmail.com> wrote:\n\n> Hi Janani, this is a test email sent from the Epitaxy HRMS application.";
  assert.equal(cleanInboundEmailBody(input), "Hi HR, Recieved");
});

test("normal single-line reply is unchanged", () => {
  assert.equal(
    cleanInboundEmailBody("Thanks, that works for me."),
    "Thanks, that works for me.",
  );
});

test("multiline reply without quoted history keeps paragraphs and breaks", () => {
  const input =
    "Hi HR,\n\nYes I can join on the 5th.\nPlease send the documents list.\n\nThanks,\nJanani";
  assert.equal(cleanInboundEmailBody(input), input);
});

test("legitimate '>' text is not removed", () => {
  const input =
    "Use this priority order: A > B > C.\n\nAlso the config block:\n> host: localhost\n> port: 5432\n\nLet me know if that is right.";
  assert.equal(cleanInboundEmailBody(input), input);
});

test("empty body returns empty string", () => {
  assert.equal(cleanInboundEmailBody(""), "");
});

test("trailing pure-quote block with no attribution line is trimmed", () => {
  const input =
    "Received, thank you.\n\n> previous message line one\n> previous message line two\n";
  assert.equal(cleanInboundEmailBody(input), "Received, thank you.");
});

test("Outlook 'Original Message' separator is cut", () => {
  const input =
    "Confirmed for Monday.\n\n-----Original Message-----\nFrom: HR\nSubject: Onboarding\n\nPlease confirm your start date.";
  assert.equal(cleanInboundEmailBody(input), "Confirmed for Monday.");
});

test("whole body is quoted history -> falls back to original trimmed", () => {
  const input =
    "On Sat, Aug 29, 2026, 9:16 PM HR <x@y.com> wrote:\n\n> original text\n";
  assert.equal(cleanInboundEmailBody(input), input.trim());
});

test("CRLF newlines are handled", () => {
  const input =
    "Hi HR, Recieved\r\n\r\nOn Sat, Aug 29, 2026, 9:16 PM HR <x@y.com> wrote:\r\n\r\n> quoted";
  assert.equal(cleanInboundEmailBody(input), "Hi HR, Recieved");
});
