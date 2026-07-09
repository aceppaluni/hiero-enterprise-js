import type { MirrorNodeClient } from "../MirrorNodeClient.js";
import { AccountRepository } from "./AccountRepository.js";
import { NftRepository } from "./NftRepository.js";
import { TokenRepository } from "./TokenRepository.js";
import { TopicRepository } from "./TopicRepository.js";
import { TransactionRepository } from "./TransactionRepository.js";
import { NetworkRepository } from "./NetworkRepository.js";
import { ScheduleRepository } from "./ScheduleRepository.js";
import { BlockRepository } from "./BlockRepository.js";
import { ContractRepository } from "./ContractRepository.js";

/**
 * Every repository in this package, constructed over one shared client.
 * Framework adapters extend this to expose the read side, so adding a
 * repository here flows into all of them without adapter changes.
 */
export interface MirrorRepositories {
    accountRepository: AccountRepository;
    nftRepository: NftRepository;
    tokenRepository: TokenRepository;
    topicRepository: TopicRepository;
    transactionRepository: TransactionRepository;
    networkRepository: NetworkRepository;
    scheduleRepository: ScheduleRepository;
    blockRepository: BlockRepository;
    contractRepository: ContractRepository;
}

/**
 * Construct one of every repository over a shared {@link MirrorNodeClient}
 * (they all draw from its concurrency/rate gate).
 */
export function createMirrorRepositories(
    mirrorNodeClient: MirrorNodeClient,
): MirrorRepositories {
    return {
        accountRepository: new AccountRepository(mirrorNodeClient),
        nftRepository: new NftRepository(mirrorNodeClient),
        tokenRepository: new TokenRepository(mirrorNodeClient),
        topicRepository: new TopicRepository(mirrorNodeClient),
        transactionRepository: new TransactionRepository(mirrorNodeClient),
        networkRepository: new NetworkRepository(mirrorNodeClient),
        scheduleRepository: new ScheduleRepository(mirrorNodeClient),
        blockRepository: new BlockRepository(mirrorNodeClient),
        contractRepository: new ContractRepository(mirrorNodeClient),
    };
}

/**
 * Repository class ↔ {@link MirrorRepositories} property pairs, for
 * dependency-injection containers that register each repository under its
 * class token (e.g. the Nest adapter). Kept adjacent to
 * {@link createMirrorRepositories} so the two cannot drift apart.
 */
export const MIRROR_REPOSITORY_TOKENS = [
    [AccountRepository, "accountRepository"],
    [NftRepository, "nftRepository"],
    [TokenRepository, "tokenRepository"],
    [TopicRepository, "topicRepository"],
    [TransactionRepository, "transactionRepository"],
    [NetworkRepository, "networkRepository"],
    [ScheduleRepository, "scheduleRepository"],
    [BlockRepository, "blockRepository"],
    [ContractRepository, "contractRepository"],
] as const satisfies ReadonlyArray<
    readonly [
        new (mirrorNodeClient: MirrorNodeClient) => object,
        keyof MirrorRepositories,
    ]
>;
