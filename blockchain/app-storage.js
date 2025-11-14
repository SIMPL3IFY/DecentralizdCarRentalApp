// ===================== BANNER =====================
// Helps you confirm the newest build is running in the browser console.
console.log("app.js BUILD (ganache-only)", Date.now());

/* ===================== CONFIG =====================
Centralized knobs for your environment.
*/
const RPC_HTTP = "http://127.0.0.1:8545"; // Local Ganache RPC URL
const EXPECT_CHAIN_ID = 1337; // Expected Ganache chain id
const WEB3_URL = "https://esm.sh/web3@4?bundle&v=" + Date.now(); // ESM CDN + cache-buster
const ABI_PATHS = [
    // Where to try to load ABI from
    "/build/contracts/Storage.json", // Truffle artifacts path
];
const DEFAULT_ADDRESS = ""; // Optionally hardcode deployed address
const USE_INLINE_ABI = false; // Toggle to skip fetching ABI files
const INLINE_ABI = [
    // If USE_INLINE_ABI=true, paste your contract ABI here to avoid fetching from disk.
];

/* ===================== STATE =====================
Runtime variables populated after initialization.
*/
let Web3Ctor = null; // Will hold the Web3 class (constructor) after dynamic import
let web3; // Web3 instance (connected to Ganache RPC)
let accounts = []; // Unlocked Ganache accounts
let defaultFrom = null; // Currently selected "from" address for sends
let contract; // web3.eth.Contract instance after initContract()
let contractABI = null; // Cached ABI once loaded
let bound = false; // Guard so DOM event wiring happens only once

/* ===================== LOGGING & DOM HELPERS =====================
$ -> quick getElementById
log -> prints to on-page log box (if present) and to browser console
*/
const $ = (id) => document.getElementById(id);
const log = (m) => {
    const el = $("log");
    if (el) {
        el.textContent += m + "\n"; // append line
        el.scrollTop = el.scrollHeight; // auto-scroll to bottom
    }
    console.log("[DApp]", m); // mirror to dev console
};

/* ===================== WEB3 IMPORT =====================
Dynamically import Web3 from a CDN (ESM build). Cached so we don't import more than once.
*/
async function dynamicImportWeb3() {
    if (Web3Ctor) return Web3Ctor; // already imported
    log("Importing Web3 module...");
    const mod = await import(WEB3_URL); // ESM dynamic import from CDN
    if (!mod?.Web3) throw new Error("Web3 ESM not available from CDN");
    Web3Ctor = mod.Web3; // grab the constructor
    log("Web3 module loaded");
    return Web3Ctor;
}

/* ===================== FETCH JSON (no cache) =====================
Small helper to fetch local JSON files (e.g., Truffle contract artifacts).
cache:'no-store' ensures we don't get stale ABIs during development.
*/
async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return res.json();
}

/* ===================== LOAD ABI =====================
Strategy:
1) If USE_INLINE_ABI=true, use INLINE_ABI. This option is for you to load contract manually
2) Else try ABI_PATHS in order until one succeeds. You can mention many paths.
*/
async function loadABI() {
    if (USE_INLINE_ABI) {
        if (!INLINE_ABI.length) throw new Error("INLINE_ABI is empty");
        contractABI = INLINE_ABI;
        log("ABI loaded from INLINE_ABI");
        return contractABI;
    }
    if (contractABI) return contractABI; // cached
    let lastErr;
    for (const p of ABI_PATHS) {
        try {
            const art = await fetchJSON(p); // try this path
            if (art?.abi) {
                contractABI = art.abi; // cache & return
                log(`ABI loaded from ${p}`);
                return contractABI;
            }
        } catch (e) {
            lastErr = e;
        } // remember last error for debugging
    }
    throw new Error(`Unable to load ABI. ${lastErr?.message || lastErr || ""}`);
}

/* ===================== FEE MODEL CHECK =====================
Detects whether the chain supports EIP-1559 (London fork).
Ganache can emulate this; affects how we set gas fees.
*/
async function supports1559() {
    const latest = await web3.eth.getBlock("latest");
    return latest && latest.baseFeePerGas != null; // presence of baseFee => EIP-1559
}

/* ===================== DIRECT RPC INIT (NO METAMASK) =====================
Connect straight to Ganache using HTTP provider; fetch accounts & chain id.
*/
async function initRPC() {
    try {
        log(`Connecting to Ganache RPC at ${RPC_HTTP} ...`);
        const Web3 = await dynamicImportWeb3();
        web3 = new Web3(
            new Web3.providers.HttpProvider(RPC_HTTP, { keepAlive: true })
        );

        // Get unlocked accounts from Ganache
        accounts = await web3.eth.getAccounts();
        if (!accounts?.length)
            throw new Error("No accounts from Ganache. Is it running?");
        defaultFrom = accounts[0];

        // Show chain id and default account in the UI
        const chainId = await web3.eth.getChainId();
        $("account") && ($("account").textContent = defaultFrom);
        $("network") && ($("network").textContent = String(chainId));

        // Warn if the connected chain is not the one expected
        if (EXPECT_CHAIN_ID != null && chainId !== EXPECT_CHAIN_ID) {
            log(
                `Warning: expected chainId ${EXPECT_CHAIN_ID} but got ${chainId}`
            );
        }

        log(`RPC connected. defaultFrom=${defaultFrom}`);
    } catch (e) {
        console.error(e);
        log("RPC init error: " + (e.message || e));
    }
}

/* ===================== CONTRACT INIT =====================
Build a web3.eth.Contract instance using the ABI and user-provided address.
*/
async function initContract() {
    try {
        if (!web3) {
            log("Initialize RPC first");
            return;
        }
        // Load ABI (inline or from artifacts)
        const abi = await loadABI();
        // Prefer user-entered address; fallback to DEFAULT_ADDRESS
        const address =
            ($("contractAddress")?.value || "").trim() || DEFAULT_ADDRESS;
        if (!address || !address.startsWith("0x")) {
            log("Enter a valid 0x address");
            return;
        }
        // Create contract instance bound to address
        contract = new web3.eth.Contract(abi, address);
        // Reflect status in UI
        $("contractStatus") &&
            ($("contractStatus").textContent = `Loaded at ${address}`);
        log("Contract initialized at " + address);
    } catch (e) {
        log("Init error: " + (e.message || e));
    }
}

/* ===================== ACTION: store(uint) =====================
Sends a transaction to store a number in the Storage contract.
- Estimates gas
- Chooses fee style (legacy vs EIP-1559)
*/
async function storeValue() {
    try {
        if (!contract || !defaultFrom) {
            log("Init RPC & load contract first");
            return;
        }
        // Read and validate number input
        const n = Number(($("storeInput")?.value || "").trim());
        if (!Number.isFinite(n)) {
            log("Enter a valid number");
            return;
        }
        log(`Sending store(${n}) from ${defaultFrom} ...`);

        // Estimate gas for this call
        const gas = await contract.methods
            .store(n)
            .estimateGas({ from: defaultFrom });
        const opts = { from: defaultFrom, gas };

        // Choose fee model based on EIP-1559 support
        if (!(await supports1559())) {
            opts.gasPrice = await web3.eth.getGasPrice(); // Legacy type-0
            log(`Legacy tx (gasPrice=${opts.gasPrice})`);
        } else {
            // Often Ganache fills maxFeePerGas / maxPriorityFeePerGas if omitted
            log("EIP-1559 supported; provider will set fees");
        }

        // Send transaction
        const tx = await contract.methods.store(n).send(opts);
        log("store() tx: " + tx.transactionHash);
    } catch (e) {
        log("store() error: " + (e.message || e));
    }
}

/* ===================== ACTION: retrieve() (call) =====================
Calls (no gas) the view function to read the currently stored value.
*/
async function retrieveValue() {
    try {
        if (!contract) {
            log("Load contract first");
            return;
        }
        const v = await contract.methods.retrieve().call(); // call => no state change
        $("currentValue") && ($("currentValue").textContent = v);
        log("retrieve() = " + v);
    } catch (e) {
        log("retrieve() error: " + (e.message || e));
    }
}

/* ===================== UI WIRING =====================
Attach button handlers once the DOM is ready (and only once).
*/
document.addEventListener("DOMContentLoaded", () => {
    if (bound) return; // guard against double-binding
    bound = true;

    // Re-label and wire the RPC init button
    const connectBtn = $("connectBtn");
    if (connectBtn) {
        connectBtn.textContent = "Init RPC (Ganache)";
        connectBtn.addEventListener("click", initRPC);
    }

    // Wire remaining buttons
    $("initBtn")?.addEventListener("click", initContract);
    $("storeBtn")?.addEventListener("click", storeValue);
    $("retrieveBtn")?.addEventListener("click", retrieveValue);

    log("App ready — click Init RPC (Ganache)");
});
