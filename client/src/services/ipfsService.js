import { create } from "ipfs-http-client";

class IPFSService {
    constructor() {
        this.client = create({
            // Make sure your local IPFS node is running with the HTTP API on 127.0.0.1:5001
            host: "127.0.0.1",
            port: 5001,
            protocol: "http",
        });
    }

    async uploadFile(file) {
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

            console.log("result", result.cid.toString());
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

        
        return `http://127.0.0.1:8080/ipfs/${hash}`;
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
