/**
 * Run with: npm start   (or: node src/main.js)
 *
 * The point of this sample is its package.json: ONE dependency, no
 * operator account, no environment variables, no build step. Everything
 * below reads live mainnet data through the public mirror node.
 */
import {
    createMirrorNodeClient,
    AccountRepository,
    NetworkRepository,
    TransactionRepository,
    tinybarToHbar,
} from "@hiero-enterprise/mirror";

const mirror = createMirrorNodeClient({ network: "mainnet" });

// Network supply — how much HBAR is released out of the fixed total.
const network = new NetworkRepository(mirror);
const supply = await network.findNetworkSupplies();
const released = tinybarToHbar(supply.releasedSupply);
const total = tinybarToHbar(supply.totalSupply);
const whole = { maximumFractionDigits: 0 };
console.log(
    `Released supply: ${released.toLocaleString(undefined, whole)}` +
        ` of ${total.toLocaleString(undefined, whole)} ℏ` +
        ` (${((released / total) * 100).toFixed(1)}%)`,
);

// Exchange rate — the network's own HBAR/USD-cent rate.
const { currentRate } = await network.findExchangeRates();
const usd = currentRate.centEquivalent / currentRate.hbarEquivalent / 100;
console.log(`Exchange rate: $${usd.toFixed(4)} per ℏ`);

// Any account, by id — here the staking reward pool.
const accounts = new AccountRepository(mirror);
const rewardPool = await accounts.findByAccountId("0.0.800");
console.log(
    `Account (0.0.800): ${tinybarToHbar(rewardPool.balance).toLocaleString()} ℏ`,
);

// Recent activity — one page of the latest transfers, newest first.
const transactions = new TransactionRepository(mirror);
const page = await transactions.find({
    transactionType: "CRYPTOTRANSFER",
    limit: 5,
    order: "desc",
});
console.log("Latest transfers:");
for (const tx of page.data) {
    console.log(
        `  ${tx.consensusTimestamp}  ${tx.transactionId}` +
            `  fee ${tinybarToHbar(tx.chargedTxFee).toFixed(4)} ℏ`,
    );
}
