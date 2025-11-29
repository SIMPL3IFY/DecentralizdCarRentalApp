import { create } from "ipfs-http-client";

class IPFSService {
    constructor() {
        const projectId =
            import.meta.env.VITE_INFURA_IPFS_PROJECT_ID || "";
        const projectSecret =
            import.meta.env.VITE_INFURA_IPFS_PROJECT_SECRET || "";

        if (projectId && projectSecret) {
            const auth = `Basic ${btoa(`${projectId}:${projectSecret}`)}`;

            this.client = create({
                host: "ipfs.infura.io",
                port: 5001,
                protocol: "https",
                headers: {
                    authorization: auth,
                },
            });
            this.isConfigured = true;
        } else {
            console.warn(
                "IPFS credentials not configured. Set VITE_INFURA_IPFS_PROJECT_ID and VITE_INFURA_IPFS_PROJECT_SECRET in .env.local to enable IPFS uploads."
            );
            this.client = null;
            this.isConfigured = false;
        }
    }

    isIPFSConfigured() {
        return this.isConfigured && this.client;
    }

    async uploadFile(file) {
        if (!this.isIPFSConfigured()) {
            throw new Error(
                "IPFS is not configured. Please set VITE_INFURA_IPFS_PROJECT_ID and VITE_INFURA_IPFS_PROJECT_SECRET in .env.local"
            );
        }

        try {
            const fileBuffer = await file.arrayBuffer();

            const fileName = file.name || "file";
            const fileExtension = fileName.split(".").pop().toLowerCase();
            const mimeType = file.type;

            const fileWithMetadata = {
                path: fileName,
                content: fileBuffer,
            };

            const result = await this.client.add(fileWithMetadata, {
                pin: true,
                wrapWithDirectory: false,
            });

            const ipfsHash = result.cid.toString();
            const ipfsURI = `ipfs://${ipfsHash}`;

            return {
                uri: ipfsURI,
                hash: ipfsHash,
                extension: fileExtension,
                mimeType: mimeType,
                fileName: fileName,
            };
        } catch (error) {
            console.error("IPFS upload error:", error);
            throw new Error(`Failed to upload to IPFS: ${error.message}`);
        }
    }

    async uploadFiles(files) {
        if (!this.isIPFSConfigured()) {
            throw new Error("IPFS is not configured");
        }

        try {
            const uploadPromises = Array.from(files).map((file) =>
                this.uploadFile(file)
            );
            return await Promise.all(uploadPromises);
        } catch (error) {
            console.error("IPFS batch upload error:", error);
            throw new Error(`Failed to upload files to IPFS: ${error.message}`);
        }
    }

    getGatewayURL(ipfsURI) {
        if (!ipfsURI) return null;

        if (typeof ipfsURI === "object" && ipfsURI.uri) {
            ipfsURI = ipfsURI.uri;
        }

        let actualURI = ipfsURI;
        if (typeof ipfsURI === "string" && ipfsURI.includes("|type:")) {
            actualURI = ipfsURI.split("|")[0];
        }

        if (!actualURI.startsWith("ipfs://")) {
            return actualURI;
        }

        const hash = actualURI.replace("ipfs://", "");
        return `https://ipfs.io/ipfs/${hash}`;
    }

    getFileExtension(ipfsURI) {
        if (!ipfsURI) return null;

        if (typeof ipfsURI === "object") {
            return ipfsURI.extension || null;
        }

        const match = ipfsURI.match(/\.([^.?#]+)(?:\?|#|$)/i);
        return match ? match[1].toLowerCase() : null;
    }

    getMimeType(ipfsURI) {
        if (!ipfsURI) return null;

        if (typeof ipfsURI === "object") {
            return ipfsURI.mimeType || null;
        }

        return null;
    }

    validateFileType(
        file,
        allowedTypes = [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/jpg",
        ]
    ) {
        return allowedTypes.includes(file.type);
    }

    validateFileSize(file, maxSizeMB = 10) {
        return file.size <= maxSizeMB * 1024 * 1024;
    }
}

export const ipfsService = new IPFSService();
