// --- DEV banner so we know the latest file is running ---
console.log("app.js BUILD (ganache-only)", Date.now());

// --- CONFIG ---
const RPC_HTTP = 'http://127.0.0.1:8545';                // Ganache RPC
const EXPECT_CHAIN_ID = 1337;                             // ganache-cli --chain.chainId 1337
const WEB3_URL = 'https://esm.sh/web3@4?bundle&v=' + Date.now(); // cache-bust
const ABI_PATHS = [
  '/build/contracts/Storage.json',
  '/artifacts/contracts/Storage.sol/Storage.json',
];
const DEFAULT_ADDRESS = ''; // e.g., "0x1234..."; optional
const USE_INLINE_ABI = false;
const INLINE_ABI = [
  // Paste your ABI entries here and set USE_INLINE_ABI=true to skip fetching.
];

// --- STATE ---
let Web3Ctor = null;
let web3;
let accounts = [];
let defaultFrom = null;
let contract;
let contractABI = null;
let bound = false;

// --- UTILS ---
const $ = (id)=>document.getElementById(id);
const log = (m)=>{ const el=$("log"); if (el) { el.textContent += m + "\n"; el.scrollTop = el.scrollHeight; } console.log("[DApp]", m); };

async function dynamicImportWeb3() {
  if (Web3Ctor) return Web3Ctor;
  log("Importing Web3 module...");
  const mod = await import(WEB3_URL);
  if (!mod?.Web3) throw new Error("Web3 ESM not available from CDN");
  Web3Ctor = mod.Web3;
  log("Web3 module loaded");
  return Web3Ctor;
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function loadABI() {
  if (USE_INLINE_ABI) {
    if (!INLINE_ABI.length) throw new Error("INLINE_ABI is empty");
    contractABI = INLINE_ABI;
    log("ABI loaded from INLINE_ABI");
    return contractABI;
  }
  if (contractABI) return contractABI;
  let lastErr;
  for (const p of ABI_PATHS) {
    try {
      const art = await fetchJSON(p);
      if (art?.abi) {
        contractABI = art.abi;
        log(`ABI loaded from ${p}`);
        return contractABI;
      }
    } catch (e) { lastErr = e; }
  }
  throw new Error(`Unable to load ABI. ${lastErr?.message || lastErr || ''}`);
}

// --- FEES helper: detect EIP-1559 support (London) ---
async function supports1559() {
  const latest = await web3.eth.getBlock('latest');
  return latest && latest.baseFeePerGas != null;
}

// --- DIRECT RPC INIT (no MetaMask) ---
async function initRPC() {
  try {
    log(`Connecting to Ganache RPC at ${RPC_HTTP} ...`);
    const Web3 = await dynamicImportWeb3();
    web3 = new Web3(new Web3.providers.HttpProvider(RPC_HTTP, { keepAlive: true }));

    // Accounts (ganache provides unlocked accounts)
    accounts = await web3.eth.getAccounts();
    if (!accounts?.length) throw new Error("No accounts from Ganache. Is it running?");
    defaultFrom = accounts[0];

    // Network / chain id
    const chainId = await web3.eth.getChainId();
    $("account") && ($("account").textContent = defaultFrom);
    $("network") && ($("network").textContent = String(chainId));

    if (EXPECT_CHAIN_ID != null && chainId !== EXPECT_CHAIN_ID) {
      log(`Warning: expected chainId ${EXPECT_CHAIN_ID} but got ${chainId}`);
    }

    log(`RPC connected. defaultFrom=${defaultFrom}`);
  } catch (e) {
    console.error(e);
    log("RPC init error: " + (e.message || e));
  }
}

// --- CONTRACT ---
async function initContract() {
  try {
    if (!web3) { log("Initialize RPC first"); return; }
    const abi = await loadABI();
    const address = ($("contractAddress")?.value || '').trim() || DEFAULT_ADDRESS;
    if (!address || !address.startsWith('0x')) { log("Enter a valid 0x address"); return; }
    contract = new web3.eth.Contract(abi, address);
    $("contractStatus") && ($("contractStatus").textContent = `Loaded at ${address}`);
    log("Contract initialized at " + address);
  } catch (e) {
    log("Init error: " + (e.message || e));
  }
}

// --- ACTIONS ---
async function storeValue() {
  try {
    if (!contract || !defaultFrom) { log("Init RPC & load contract first"); return; }
    const n = Number(($("storeInput")?.value || '').trim());
    if (!Number.isFinite(n)) { log("Enter a valid number"); return; }
    log(`Sending store(${n}) from ${defaultFrom} ...`);

    const gas = await contract.methods.store(n).estimateGas({ from: defaultFrom });
    const opts = { from: defaultFrom, gas };

    if (!(await supports1559())) {
      opts.gasPrice = await web3.eth.getGasPrice(); // legacy type-0
      log(`Legacy tx (gasPrice=${opts.gasPrice})`);
    } else {
      // For Ganache London mode, provider usually fills maxFee/maxPriority if omitted
      log("EIP-1559 supported; provider will set fees");
    }

    const tx = await contract.methods.store(n).send(opts);
    log("store() tx: " + tx.transactionHash);
  } catch (e) {
    log("store() error: " + (e.message || e));
  }
}

async function retrieveValue() {
  try {
    if (!contract) { log("Load contract first"); return; }
    const v = await contract.methods.retrieve().call();
    $("currentValue") && ($("currentValue").textContent = v);
    log("retrieve() = " + v);
  } catch (e) {
    log("retrieve() error: " + (e.message || e));
  }
}

// --- WIRE UI ---
document.addEventListener("DOMContentLoaded", ()=>{
  if (bound) return;
  bound = true;

  // If your HTML had a "Connect Wallet" button, we can repurpose it to "Init RPC"
  const connectBtn = $("connectBtn");
  if (connectBtn) {
    connectBtn.textContent = "Init RPC (Ganache)";
    connectBtn.addEventListener("click", initRPC);
  }

  $("initBtn")?.addEventListener("click", initContract);
  $("storeBtn")?.addEventListener("click", storeValue);
  $("retrieveBtn")?.addEventListener("click", retrieveValue);

  log("App ready — click Init RPC (Ganache)");
});
