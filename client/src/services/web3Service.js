import Web3 from "web3";
import { RPC_URL } from "../constants/config";

class Web3Service {
    constructor() {
        this.web3 = null;
        this.account = null;
        this.accounts = [];
        this.chainId = null;
        this.accountChangeListeners = [];
    }

    async init() {
        try {
            this.web3 = new Web3(RPC_URL);
            const [chainId, accounts] = await Promise.all([
                this.web3.eth.getChainId(),
                this.web3.eth.getAccounts(),
            ]);

            this.chainId = String(chainId);
            const oldAccount = this.account;
            this.account = accounts.length > 0 ? accounts[0] : null;
            this.accounts = accounts;

            if (oldAccount !== this.account && this.account) {
                this.notifyAccountChange(this.account, oldAccount);
            }

            return {
                success: true,
                account: this.account,
                chainId: this.chainId,
                accounts: accounts,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }

    async getAccounts() {
        if (!this.web3) return [];
        try {
            this.accounts = await this.web3.eth.getAccounts();
            return this.accounts;
        } catch (error) {
            console.error("Error getting accounts:", error);
            return this.accounts || [];
        }
    }

    async switchAccount(accountAddress) {
        if (!this.web3) throw new Error("Web3 not initialized");

        const accounts = await this.getAccounts();
        if (!accounts.includes(accountAddress)) {
            throw new Error("Account not found");
        }

        const oldAccount = this.account;
        this.account = accountAddress;

        if (oldAccount !== accountAddress) {
            this.notifyAccountChange(accountAddress, oldAccount);
        }

        return { success: true, account: this.account };
    }

    onAccountChange(callback) {
        this.accountChangeListeners.push(callback);
        return () => {
            this.accountChangeListeners = this.accountChangeListeners.filter(
                (listener) => listener !== callback
            );
        };
    }

    notifyAccountChange(newAccount, oldAccount) {
        this.accountChangeListeners.forEach((listener) => {
            try {
                listener(newAccount, oldAccount);
            } catch (error) {
                console.error("Error in account change listener:", error);
            }
        });
    }

    getWeb3() {
        return this.web3;
    }

    getAccount() {
        return this.account;
    }

    getChainId() {
        return this.chainId;
    }

    isInitialized() {
        return this.web3 !== null;
    }

    toWei(value, unit = "ether") {
        if (!this.web3) throw new Error("Web3 not initialized");
        return this.web3.utils.toWei(value, unit);
    }

    fromWei(value, unit = "ether") {
        if (!this.web3) throw new Error("Web3 not initialized");
        return this.web3.utils.fromWei(value, unit);
    }
}

export const web3Service = new Web3Service();
