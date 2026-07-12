import type { HieroConfig } from "@hiero-enterprise/core";
import {
    HieroContext,
    AccountService,
    ScheduleService,
    FileService,
    TokenService,
    ContractService,
    TopicService,
} from "@hiero-enterprise/core";
import type {
    MirrorConfig,
    MirrorNodeClient,
    MirrorRepositories,
} from "@hiero-enterprise/mirror";
import {
    createMirrorNodeClient,
    createMirrorRepositories,
} from "@hiero-enterprise/mirror";

/**
 * Combined configuration for a full Hiero integration: the SDK/consensus
 * side (`HieroConfig`) plus the mirror node REST side (`MirrorConfig`).
 * The shape is flat, matching the pre-split config exactly.
 */
export type HieroAdapterConfig = HieroConfig & MirrorConfig;

/**
 * All services made available through the framework integration —
 * write-side services from `@hiero-enterprise/core`, plus every read-side
 * repository from `@hiero-enterprise/mirror` (one property per
 * {@link MirrorRepositories} entry, so new repositories appear here
 * without adapter changes).
 */
export interface HieroServices extends MirrorRepositories {
    context: HieroContext;
    accountService: AccountService;
    scheduleService: ScheduleService;
    fileService: FileService;
    tokenService: TokenService;
    contractService: ContractService;
    topicService: TopicService;
}

export interface HieroRuntime extends HieroServices {
    mirrorNodeClient: MirrorNodeClient;
    close(): void;
}

/**
 * Compose the full Hiero runtime graph from core + mirror. Config falls
 * back to environment variables when omitted.
 */
export function createHieroRuntime(config?: HieroAdapterConfig): HieroRuntime {
    const context = new HieroContext(config);
    // When config is omitted, the mirror side resolves from the same
    // HIERO_* environment variables the context used.
    const mirrorNodeClient = createMirrorNodeClient(config);

    return {
        context,
        mirrorNodeClient,
        accountService: new AccountService(context),
        scheduleService: new ScheduleService(context),
        fileService: new FileService(context),
        tokenService: new TokenService(context),
        contractService: new ContractService(context),
        topicService: new TopicService(context),
        ...createMirrorRepositories(mirrorNodeClient),
        close: () => context.close(),
    };
}
