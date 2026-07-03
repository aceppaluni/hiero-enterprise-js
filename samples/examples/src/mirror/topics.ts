/**
 * Run this example with:
 * npx tsx samples/examples/src/mirror/topics.ts
 *
 * End-to-end tour of TOPIC (HCS) message queries against the mirror node —
 * no operator credentials required.
 *
 * What it shows, in order:
 *   1. The latest messages on a topic (`limit` + `order: "desc"`), with the
 *      base64 payload decoded for preview.
 *   2. A specific message fetched by sequence number — sequence 1 is the
 *      topic's very first message, so it always exists.
 *   3. The same message re-fetched by consensus timestamp alone — no topic
 *      ID needed, useful when all you have is a transaction's timestamp.
 *
 * The default topic (0.0.368908) is a long-lived, very active mainnet topic
 * with tens of millions of messages.
 *
 * Configure via env (all optional):
 *   HIERO_MIRROR_NODE_URL   default: https://mainnet.mirrornode.hedera.com
 *   EXAMPLE_TOPIC_ID        default: 0.0.368908
 */
import { MirrorNodeClient, TopicRepository } from "@hiero-enterprise/mirror";

const mirrorUrl =
    process.env["HIERO_MIRROR_NODE_URL"] ??
    "https://mainnet.mirrornode.hedera.com";
const topicId = process.env["EXAMPLE_TOPIC_ID"] ?? "0.0.368908";

const mirror = new MirrorNodeClient(mirrorUrl, {
    maxConcurrent: 5,
    maxRequestsPerSecond: 25,
});
const topics = new TopicRepository(mirror);

/** Topic payloads are base64; decode and truncate for display. */
function preview(base64: string, max = 60): string {
    const text = Buffer.from(base64, "base64").toString("utf-8");
    const clean = text.replace(/\s+/g, " ").trim();
    return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

console.log(`\nTopic message queries example — ${mirrorUrl}\n`);

// ── 1 · latest messages ──────────────────────────────────────────
const latest = await topics.findByTopicId(topicId, {
    limit: 3,
    order: "desc",
});
console.log(`1 · findByTopicId("${topicId}", { limit: 3, order: "desc" })`);
for (const message of latest.data) {
    console.log(
        `    seq ${message.sequenceNumber} @ ${message.consensusTimestamp}`,
    );
    console.log(`      "${preview(message.message)}"`);
}
console.log(`    more pages: ${latest.next !== null}`);

// ── 2 · a specific message by sequence number ────────────────────
const first = await topics.findByTopicIdAndSequenceNumber(topicId, 1);
console.log(`\n2 · findByTopicIdAndSequenceNumber("${topicId}", 1)`);
console.log(
    `    the topic's first-ever message, from ${first.consensusTimestamp}:`,
);
console.log(`      "${preview(first.message)}"`);

// ── 3 · the same message by consensus timestamp alone ────────────
// No topic ID required — a consensus timestamp uniquely identifies the
// message network-wide.
const byTimestamp = await topics.findMessageByTimestamp(
    first.consensusTimestamp,
);
console.log(`\n3 · findMessageByTimestamp("${first.consensusTimestamp}")`);
console.log(
    `    resolves back to topic ${byTimestamp.topicId}, seq ${byTimestamp.sequenceNumber}`,
);
console.log();
