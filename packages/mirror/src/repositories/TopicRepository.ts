import type {
    MirrorTopicMessage,
    MirrorTopicInfo,
    Page,
    TopicMessagesQuery,
} from "../types/index.js";
import type { MirrorNodeClient } from "../client/MirrorNodeClient.js";

/**
 * Repository for querying topic messages from the mirror node.
 *
 * List methods accept an optional {@link PageQuery} (`limit` / `order`) and
 * return a continuable {@link Page}; walk multiple pages with the
 * `collectAll` / `paginate` helpers, or `Page.next()` directly.
 */
export class TopicRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * Topic metadata — memo, keys, custom fees — via the free mirror REST
     * API (core's getTopicInfo costs a consensus query).
     */
    findById(topicId: string): Promise<MirrorTopicInfo> {
        return this.mirrorNodeClient.queryTopic(topicId);
    }

    /**
     * Find messages for a topic — optionally windowed by sequence-number
     * range or consensus timestamp.
     */
    findByTopicId(
        topicId: string,
        options?: TopicMessagesQuery,
    ): Promise<Page<MirrorTopicMessage>> {
        return this.mirrorNodeClient.queryTopicMessages(topicId, options);
    }

    /**
     * Find a specific message by topic ID and sequence number.
     */
    findByTopicIdAndSequenceNumber(
        topicId: string,
        sequenceNumber: number,
    ): Promise<MirrorTopicMessage> {
        return this.mirrorNodeClient.queryTopicMessageBySequence(
            topicId,
            sequenceNumber,
        );
    }

    /**
     * Find a message by its consensus timestamp alone — no topic ID needed.
     */
    findMessageByTimestamp(timestamp: string): Promise<MirrorTopicMessage> {
        return this.mirrorNodeClient.queryTopicMessageByTimestamp(timestamp);
    }
}
