import {
    Module,
    type DynamicModule,
    type Provider,
    type Type,
    type ForwardReference,
    type InjectionToken,
} from "@nestjs/common";
import {
    resolveConfigFromEnv,
    assertEnvConfigValid,
    AccountService,
    ScheduleService,
    FileService,
    TokenService,
    ContractService,
    TopicService,
} from "@hiero-enterprise/core";
import {
    MirrorNodeClient,
    mirrorConfigFromEnv,
    MIRROR_REPOSITORY_TOKENS,
} from "@hiero-enterprise/mirror";
import type { HieroAdapterConfig, HieroRuntime } from "./runtime.js";
import { createHieroRuntime } from "./runtime.js";

// ─── Injection Tokens ──────────────────────────────────────────

export const HIERO_CONFIG = "HIERO_CONFIG";
export const HIERO_CONTEXT = "HIERO_CONTEXT";
const HIERO_RUNTIME = "HIERO_RUNTIME";

/**
 * Single source of truth: DI class token → HieroRuntime property key.
 * Core services are listed here; the mirror repositories come from
 * MIRROR_REPOSITORY_TOKENS, so a repository added to mirror registers
 * itself with no change in this package.
 */
const SERVICE_TOKENS = [
    [MirrorNodeClient, "mirrorNodeClient"],
    [AccountService, "accountService"],
    [ScheduleService, "scheduleService"],
    [FileService, "fileService"],
    [TokenService, "tokenService"],
    [ContractService, "contractService"],
    [TopicService, "topicService"],
    ...MIRROR_REPOSITORY_TOKENS,
] as const satisfies ReadonlyArray<
    readonly [Type<unknown>, keyof HieroRuntime]
>;

const EXPORTED_TOKENS = [
    HIERO_CONFIG,
    HIERO_CONTEXT,
    ...SERVICE_TOKENS.map(([token]) => token),
];

type NestImport =
    | Type<unknown>
    | DynamicModule
    | Promise<DynamicModule>
    | ForwardReference;

/**
 * Options for async configuration of HieroModule.
 */
export interface HieroModuleAsyncOptions {
    /** Imports needed for config injection */
    imports?: NestImport[];
    /** Factory function returning HieroConfig */
    useFactory: (
        ...args: unknown[]
    ) => HieroAdapterConfig | Promise<HieroAdapterConfig>;
    /** Dependencies to inject into the factory */
    inject?: InjectionToken[];
    /** Whether this module should be global in the Nest container */
    global?: boolean;
}

// HieroModule definition

/**
 * NestJS module that provides all Hiero services via dependency injection.
 *
 * @example
 * ```ts
 * // Option 1: Environment-based config
 * import { HieroModule } from '@hiero-enterprise/nest';
 * @Module({ imports: [HieroModule.forRoot()] })
 * export class AppModule {}
 *
 * // Option 2: Explicit config
 * @Module({
 *   imports: [HieroModule.forRoot({ network: 'testnet', operatorId: '0.0.1', operatorKey: '302e...' })]
 * })
 * export class AppModule {}
 *
 * // Option 3: Async config (e.g., from ConfigService)
 * @Module({
 *   imports: [HieroModule.forRootAsync({
 *     imports: [ConfigModule],
 *     inject: [ConfigService],
 *     useFactory: (config: ConfigService) => ({
 *       network: config.get('HIERO_NETWORK'),
 *       operatorId: config.get('HIERO_OPERATOR_ID'),
 *       operatorKey: config.get('HIERO_OPERATOR_KEY'),
 *     }),
 *   })]
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class HieroModule {
    /**
     * Register the module with all Hiero services as providers.
     *
     * @param config - Optional explicit config (falls back to env vars)
     * @returns Dynamic NestJS module definition
     */
    static forRoot(
        config?: HieroAdapterConfig,
        opts?: { global?: boolean },
    ): DynamicModule {
        if (!config) {
            // If no config provided, validate env vars and resolve config from env
            // This will throw an error if required env vars are missing or invalid
            // with steps to fix the issue.
            assertEnvConfigValid();
        }
        const resolved = config ?? {
            ...resolveConfigFromEnv()!,
            ...mirrorConfigFromEnv(),
        };
        const runtime = createHieroRuntime(resolved);

        const providers: Provider[] = [
            { provide: HIERO_CONFIG, useValue: resolved },
            { provide: HIERO_CONTEXT, useValue: runtime.context },
            ...SERVICE_TOKENS.map(([token, key]) => ({
                provide: token,
                // eslint-disable-next-line security/detect-object-injection -- key is constrained to keyof HieroRuntime
                useValue: runtime[key],
            })),
        ];

        return {
            module: HieroModule,
            providers,
            exports: EXPORTED_TOKENS,
            global: opts?.global ?? false,
        };
    }

    /**
     * Register the module asynchronously, allowing config to be injected
     * from other modules (e.g., ConfigModule, vault services).
     */
    static forRootAsync(options: HieroModuleAsyncOptions): DynamicModule {
        const providers: Provider[] = [
            {
                provide: HIERO_CONFIG,
                useFactory: options.useFactory,
                inject: options.inject ?? [],
            },
            {
                provide: HIERO_RUNTIME,
                useFactory: (config: HieroAdapterConfig) =>
                    createHieroRuntime(config),
                inject: [HIERO_CONFIG],
            },
            {
                provide: HIERO_CONTEXT,
                useFactory: (runtime: HieroRuntime) => runtime.context,
                inject: [HIERO_RUNTIME],
            },
            ...SERVICE_TOKENS.map(([token, key]) => ({
                provide: token,
                // eslint-disable-next-line security/detect-object-injection -- key is constrained to keyof HieroRuntime
                useFactory: (runtime: HieroRuntime) => runtime[key],
                inject: [HIERO_RUNTIME],
            })),
        ];

        return {
            module: HieroModule,
            imports: options.imports ?? [],
            providers,
            exports: EXPORTED_TOKENS,
            global: options.global ?? false,
        };
    }
}

// Re-export service and repository classes used as NestJS DI tokens.
export {
    AccountService,
    ScheduleService,
    FileService,
    TokenService,
    ContractService,
    TopicService,
    AccountType,
    OperatorKeyType,
} from "@hiero-enterprise/core";
export {
    MirrorNodeClient,
    AccountRepository,
    NftRepository,
    TokenRepository,
    TopicRepository,
    TransactionRepository,
    NetworkRepository,
    ScheduleRepository,
    BlockRepository,
    ContractRepository,
} from "@hiero-enterprise/mirror";
export type { HieroConfig } from "@hiero-enterprise/core";
export type { HieroAdapterConfig, HieroServices } from "./runtime.js";

// Nest-specific decorator helpers
export { InjectHieroContext, InjectHieroConfig } from "./decorators.js";
