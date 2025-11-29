import { ipfsService } from "./ipfsService";

class FileService {
    // Generate SHA-256 hash from file content
    async generateFileHash(file) {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        return hashHex;
    }

    // Store file data in localStorage using hash as key
    storeFileInLocalStorage(hash, dataURI, mimeType, extension, fileName) {
        const fileData = {
            dataURI,
            mimeType,
            extension,
            fileName,
            timestamp: Date.now(),
        };
        localStorage.setItem(`file_${hash}`, JSON.stringify(fileData));
    }

    // Retrieve file data from localStorage by hash
    getFileFromLocalStorage(hash) {
        const stored = localStorage.getItem(`file_${hash}`);
        if (!stored) return null;
        try {
            return JSON.parse(stored);
        } catch (e) {
            return null;
        }
    }

    // Convert file to base64 data URI
    async fileToDataURI(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (error) =>
                reject(new Error(`Failed to read file: ${error.message}`));
            reader.readAsDataURL(file);
        });
    }

    // Upload file: IPFS (if configured) or localStorage fallback
    async uploadFile(file, useIPFS = true) {
        const allowedTypes = ["application/pdf", "image/png"];
        if (!this.validateFileType(file, allowedTypes)) {
            throw new Error("Only PDF and PNG files are allowed");
        }

        if (!this.validateFileSize(file, 10)) {
            throw new Error("File size must be less than 10MB");
        }

        if (useIPFS && ipfsService.isIPFSConfigured()) {
            try {
                const ipfsResult = await ipfsService.uploadFile(file);

                // Store backup in localStorage for faster access
                try {
                    const dataURI = await this.fileToDataURI(file);
                    const fileHash = await this.generateFileHash(file);
                    this.storeFileInLocalStorage(
                        fileHash,
                        dataURI,
                        ipfsResult.mimeType,
                        ipfsResult.extension,
                        ipfsResult.fileName
                    );
                } catch (localError) {
                    console.warn("Failed to store backup in localStorage:", localError);
                }

                return {
                    uri: `${ipfsResult.uri}|type:${ipfsResult.mimeType}|ext:${ipfsResult.extension}`,
                    hash: ipfsResult.hash,
                    ipfsHash: ipfsResult.hash,
                    mimeType: ipfsResult.mimeType,
                    extension: ipfsResult.extension,
                    fileName: ipfsResult.fileName,
                    storageType: "ipfs",
                };
            } catch (ipfsError) {
                console.warn("IPFS upload failed, falling back to localStorage:", ipfsError);
            }
        }

        // Fallback to localStorage
        const result = await this.convertFileToDataURI(file);
        return {
            uri: `hash:${result.hash}|type:${result.mimeType}|ext:${result.extension}`,
            hash: result.hash,
            dataURI: result.dataURI,
            mimeType: result.mimeType,
            extension: result.extension,
            fileName: result.fileName,
            storageType: "localStorage",
        };
    }

    // Convert file to base64 data URI and generate hash
    async convertFileToDataURI(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const dataURI = e.target.result;
                    const fileName = file.name || "file";
                    const fileExtension = fileName.split(".").pop().toLowerCase();
                    const hash = await this.generateFileHash(file);

                    this.storeFileInLocalStorage(
                        hash,
                        dataURI,
                        file.type,
                        fileExtension,
                        fileName
                    );

                    resolve({
                        hash,
                        dataURI,
                        mimeType: file.type,
                        extension: fileExtension,
                        fileName,
                    });
                } catch (error) {
                    reject(new Error(`Failed to process file: ${error.message}`));
                }
            };

            reader.onerror = (error) => {
                reject(new Error(`Failed to read file: ${error.message}`));
            };

            reader.readAsDataURL(file);
        });
    }

    // Parse file URI: Supports IPFS, hash-based (localStorage), and legacy data URI formats
    parseDataURI(uriString) {
        if (!uriString) return null;

        if (uriString.startsWith("ipfs://")) {
            const parts = uriString.split("|");
            const ipfsURI = parts[0];

            let mimeType = null;
            let extension = null;
            for (const part of parts) {
                if (part.startsWith("type:")) {
                    mimeType = part.replace("type:", "");
                } else if (part.startsWith("ext:")) {
                    extension = part.replace("ext:", "").toLowerCase();
                }
            }

            return {
                dataURI: ipfsURI,
                mimeType: mimeType || "",
                extension: extension || "",
                isIPFS: true,
            };
        }

        if (uriString.startsWith("hash:")) {
            const parts = uriString.split("|");
            const hashPart = parts[0].replace("hash:", "");

            let mimeType = null;
            let extension = null;
            for (const part of parts) {
                if (part.startsWith("type:")) mimeType = part.replace("type:", "");
                else if (part.startsWith("ext:")) extension = part.replace("ext:", "").toLowerCase();
            }

            const storedFile = this.getFileFromLocalStorage(hashPart);
            if (storedFile) {
                return {
                    dataURI: storedFile.dataURI,
                    mimeType: mimeType || storedFile.mimeType || "",
                    extension: extension || storedFile.extension || "",
                };
            }

            return {
                dataURI: null,
                mimeType: mimeType || "",
                extension: extension || "",
                hash: hashPart,
            };
        }

        // Legacy data URI format
        let dataURI = uriString;
        let mimeType = null;
        let extension = null;

        if (uriString.includes("|")) {
            const parts = uriString.split("|");
            dataURI = parts[0];
            for (const part of parts) {
                if (part.startsWith("type:")) mimeType = part.replace("type:", "");
                else if (part.startsWith("ext:")) extension = part.replace("ext:", "").toLowerCase();
            }
        }

        if (!mimeType && dataURI.startsWith("data:")) {
            const match = dataURI.match(/data:([^;]+)/);
            if (match) mimeType = match[1];
        }

        if (!extension && mimeType) {
            if (mimeType === "application/pdf") extension = "pdf";
            else if (mimeType === "image/png") extension = "png";
            else if (mimeType.startsWith("image/")) extension = mimeType.split("/")[1];
        }

        return {
            dataURI,
            mimeType: mimeType || "",
            extension: extension || "",
        };
    }

    validateFileType(file, allowedTypes = ["application/pdf", "image/png"]) {
        return allowedTypes.includes(file.type);
    }

    validateFileSize(file, maxSizeMB = 10) {
        return file.size <= maxSizeMB * 1024 * 1024;
    }
}

export const fileService = new FileService();
