import { vi } from "vitest";

/**
 * Shared SDK mocking utilities for service unit tests.
 *
 * Hiero SDK transaction classes share a large surface area through their
 * common `Transaction` base — `setMaxTransactionFee`, `setTransactionMemo`,
 * `setTransactionValidDuration`, `setRegenerateTransactionId`, `setHighVolume`,
 * `setNodeAccountIds`, `_addSignatureLegacy`, `freezeWith`, `sign`, `signWith`,
 * `execute`, and `schedule`. Re-creating that shape in every test file is
 * noisy and drifts over time. The helpers below centralise the shape so each
 * service test only declares the methods that are *unique* to its operation.
 *
 * ## Why dynamic import inside `vi.hoisted`?
 *
 * `vi.mock` factories are hoisted above ESM imports, which means they cannot
 * reference statically-imported bindings. `vi.hoisted` solves that for inline
 * values, but its synchronous factory has the same constraint. Combining the
 * two — `await vi.hoisted(async () => { const m = await import(...); ... })`
 * — runs the dynamic import at hoist time, before the mocked module is
 * resolved, so the helper's output is available to the `vi.mock` factory.
 *
 * Top-level `await` in the test file is required (works in ESM modules,
 * which vitest uses for `.test.ts` files).
 */

type MockFn = ReturnType<typeof vi.fn>;

/**
 * The shape of a mocked Hiero SDK transaction. Common base-class methods are
 * typed explicitly; class-specific setters added via `extraMethods` show up as
 * additional string-keyed entries.
 */
export interface MockTransaction {
    // TransactionOptions setters (base `Transaction` class)
    setMaxTransactionFee: MockFn;
    setTransactionMemo: MockFn;
    setTransactionValidDuration: MockFn;
    setRegenerateTransactionId: MockFn;
    setHighVolume: MockFn;
    setNodeAccountIds: MockFn;
    // Offline signature application
    _addSignatureLegacy: MockFn;
    // Lifecycle
    freezeWith: MockFn;
    sign: MockFn;
    signWith: MockFn;
    execute: MockFn;
    schedule: MockFn;
    // Class-specific setters (e.g. `setKeyWithoutAlias`, `setTopicMemo`)
    [method: string]: MockFn;
}

/**
 * The schedule-side wrap of a mocked transaction. Carries the
 * `ScheduleCreateTransaction` setters that `TransactionExecutor.scheduleRun`
 * applies before delegating back to the standard `run()` lifecycle.
 */
export interface MockScheduleTransaction extends MockTransaction {
    setPayerAccountId: MockFn;
    setAdminKey: MockFn;
    setScheduleMemo: MockFn;
}

/**
 * Default receipt shape covering every entity ID the services return. Tests
 * read whichever fields are relevant for their operation; unused fields are
 * harmless.
 */
export interface MockReceipt {
    status: { toString(): string };
    accountId: { toString(): string };
    scheduleId: { toString(): string };
    topicId: { toString(): string };
    fileId: { toString(): string };
    contractId: { toString(): string };
    tokenId: { toString(): string };
    totalSupply: { toString(): string } | null;
    topicSequenceNumber: { toString(): string; toNumber(): number };
    topicRunningHash: Uint8Array;
    serials: Array<{ toNumber(): number }>;
    /** Set when a schedule-sign completed the schedule. */
    scheduledTransactionId: { toString(): string } | null;
    /** Child receipts (populated when the executor asks for them). */
    children: Array<{ accountId: { toString(): string } | null }>;
}

/** Minimal record shape for `outcome.getRecord()` consumers. */
export interface MockRecord {
    contractFunctionResult: {
        bytes: Uint8Array;
        gasUsed: { toNumber(): number };
        errorMessage: string | null;
    } | null;
}

export interface MockTransactionResponse {
    transactionId: { toString(): string };
    getReceipt: MockFn;
    /**
     * The `execute` spy behind `getRecordQuery()` — the executor fetches
     * records via a direct query, so tests count *paid record queries* by
     * counting calls to this spy (and stub record data on it).
     */
    recordExecute: MockFn;
    getRecordQuery: MockFn;
    /** Query used by the executor when child receipts are requested. */
    getReceiptQuery: MockFn;
    /** Spy behind `getReceiptQuery().setIncludeChildren(...)`. */
    setIncludeChildren: MockFn;
    /** The `execute` spy behind `getReceiptQuery()`. */
    receiptQueryExecute: MockFn;
}

/**
 * A complete pre-wired bundle: `tx.execute()` resolves to `response`,
 * `response.getReceipt()` resolves to `receipt`, and `tx.schedule()` returns
 * `scheduleTx` (also pre-wired to `response`).
 */
export interface MockTxBundle {
    tx: MockTransaction;
    scheduleTx: MockScheduleTransaction;
    response: MockTransactionResponse;
    receipt: MockReceipt;
}

function buildBaseTransactionMethods(): MockTransaction {
    return {
        setMaxTransactionFee: vi.fn().mockReturnThis(),
        setTransactionMemo: vi.fn().mockReturnThis(),
        setTransactionValidDuration: vi.fn().mockReturnThis(),
        setRegenerateTransactionId: vi.fn().mockReturnThis(),
        setHighVolume: vi.fn().mockReturnThis(),
        setNodeAccountIds: vi.fn().mockReturnThis(),
        _addSignatureLegacy: vi.fn().mockReturnThis(),
        freezeWith: vi.fn().mockReturnThis(),
        sign: vi.fn().mockResolvedValue(undefined),
        signWith: vi.fn().mockResolvedValue(undefined),
        execute: vi.fn(),
        schedule: vi.fn(),
    };
}

/**
 * Build a fresh receipt with sensible defaults. All ID fields stringify to
 * predictable values so tests can assert `expect(x).toBe("0.0.999")` etc.
 */
export function buildMockReceipt(
    overrides: Partial<MockReceipt> = {},
): MockReceipt {
    return {
        status: { toString: () => "SUCCESS" },
        accountId: { toString: () => "0.0.999" },
        scheduleId: { toString: () => "0.0.777" },
        topicId: { toString: () => "0.0.888" },
        fileId: { toString: () => "0.0.555" },
        contractId: { toString: () => "0.0.666" },
        tokenId: { toString: () => "0.0.500" },
        totalSupply: { toString: () => "1000" },
        topicSequenceNumber: { toString: () => "1", toNumber: () => 1 },
        topicRunningHash: new Uint8Array([1, 2, 3, 4]),
        serials: [],
        scheduledTransactionId: null,
        children: [],
        ...overrides,
    };
}

/** Build a record with a contract function result (or none). */
export function buildMockRecord(
    overrides: Partial<MockRecord> = {},
): MockRecord {
    return {
        contractFunctionResult: null,
        ...overrides,
    };
}

/**
 * Build a fully-wired mock transaction bundle for use inside `vi.hoisted`.
 *
 * @param extraMethods - Names of class-specific chainable setters
 *   (e.g. `["setKeyWithoutAlias", "setInitialBalance"]`). Each is wired as
 *   `vi.fn().mockReturnThis()`.
 *
 * @example
 * ```ts
 * const mocks = await vi.hoisted(async () => {
 *     const { buildMockTxBundle } = await import("../../../utils/sdk-mocks.js");
 *     return buildMockTxBundle(["setAccountId", "setTransferAccountId"]);
 * });
 *
 * vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
 *     const actual = await importOriginal<Record<string, unknown>>();
 *     return {
 *         ...actual,
 *         AccountDeleteTransaction: vi.fn(function () {
 *             return mocks.tx;
 *         }),
 *     };
 * });
 *
 * beforeEach(() => {
 *     vi.clearAllMocks();
 *     reattachMockChain(mocks);
 * });
 * ```
 */
export function buildMockTxBundle(
    extraMethods: readonly string[] = [],
): MockTxBundle {
    const receipt = buildMockReceipt();
    const recordExecute = vi.fn().mockResolvedValue(buildMockRecord());
    // Persistent spies for the child-receipt query so tests can observe
    // the whole chain (a fresh vi.fn() per call would be unassertable).
    const setIncludeChildren = vi.fn();
    const receiptQueryExecute = vi.fn().mockResolvedValue(receipt);
    const receiptQuery = {
        setIncludeChildren,
        execute: receiptQueryExecute,
    };
    setIncludeChildren.mockReturnValue(receiptQuery);
    const response: MockTransactionResponse = {
        transactionId: { toString: () => "0.0.123@1234567890.000000000" },
        getReceipt: vi.fn().mockResolvedValue(receipt),
        recordExecute,
        // Executor record path: query builder → record (spy counts paid queries).
        getRecordQuery: vi.fn(() => ({ execute: recordExecute })),
        // Executor path for child receipts: query builder → same receipt.
        getReceiptQuery: vi.fn(() => receiptQuery),
        setIncludeChildren,
        receiptQueryExecute,
    };

    const scheduleTx: MockScheduleTransaction = {
        ...buildBaseTransactionMethods(),
        setPayerAccountId: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setScheduleMemo: vi.fn().mockReturnThis(),
    };
    scheduleTx.execute.mockResolvedValue(response);

    const tx: MockTransaction = buildBaseTransactionMethods();
    tx.execute.mockResolvedValue(response);
    tx.schedule.mockReturnValue(scheduleTx);

    for (const method of extraMethods) {
        Reflect.set(tx, method, vi.fn().mockReturnThis());
    }

    return { tx, scheduleTx, response, receipt };
}

/**
 * Re-establish the bundle's `mockResolvedValue` / `mockReturnValue` /
 * `mockImplementation` wiring. With this repo's vitest config,
 * `vi.clearAllMocks()` clears call history only and leaves implementations
 * intact — so this is defensive: it keeps the bundle working even if a
 * test file resets implementations (`vi.resetAllMocks()`, `mockReset`,
 * or a `mock*Once` that consumed the default). Call from `beforeEach`
 * right after `vi.clearAllMocks()`.
 */
export function reattachMockChain(bundle: MockTxBundle): void {
    bundle.response.getReceipt.mockResolvedValue(bundle.receipt);
    bundle.response.recordExecute.mockResolvedValue(buildMockRecord());
    bundle.response.getRecordQuery.mockImplementation(() => ({
        execute: bundle.response.recordExecute,
    }));
    const receiptQuery = {
        setIncludeChildren: bundle.response.setIncludeChildren,
        execute: bundle.response.receiptQueryExecute,
    };
    bundle.response.setIncludeChildren.mockReturnValue(receiptQuery);
    bundle.response.receiptQueryExecute.mockResolvedValue(bundle.receipt);
    bundle.response.getReceiptQuery.mockImplementation(() => receiptQuery);
    bundle.tx.execute.mockResolvedValue(bundle.response);
    bundle.tx.sign.mockResolvedValue(undefined);
    bundle.tx.signWith.mockResolvedValue(undefined);
    bundle.tx.schedule.mockReturnValue(bundle.scheduleTx);
    bundle.scheduleTx.execute.mockResolvedValue(bundle.response);
    bundle.scheduleTx.sign.mockResolvedValue(undefined);
    bundle.scheduleTx.signWith.mockResolvedValue(undefined);
}
