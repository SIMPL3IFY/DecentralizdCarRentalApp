import { ipfsService } from "../services/ipfsService";

export const IPFSViewer = ({ ipfsURI, title, className = "" }) => {
    if (!ipfsURI) return null;

    let actualURI = ipfsURI;
    let fileExtension = null;
    let mimeType = null;

    if (typeof ipfsURI === 'string' && ipfsURI.includes('|type:')) {
        const parts = ipfsURI.split('|');
        actualURI = parts[0];
        
        for (const part of parts) {
            if (part.startsWith('type:')) {
                mimeType = part.replace('type:', '');
            } else if (part.startsWith('ext:')) {
                fileExtension = part.replace('ext:', '').toLowerCase();
            }
        }
    }

    const gatewayURL = ipfsService.getGatewayURL(actualURI);
    
    const hasImageExtension = fileExtension && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExtension);
    const hasPDFExtension = fileExtension === 'pdf';
    const isImageType = (mimeType && mimeType.startsWith('image/')) || hasImageExtension || actualURI.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
    const isPDFType = (mimeType === 'application/pdf') || hasPDFExtension || actualURI.match(/\.pdf$/i);

    return (
        <div className={`mt-2 ${className}`}>
            <a
                href={gatewayURL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 mb-2"
            >
                {title || 'View Document'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
            </a>
            {isPDFType ? (
                <div className="mt-2">
                    <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4">
                        <iframe
                            src={`${gatewayURL}#view=FitH`}
                            className="w-full h-96 border border-gray-300 rounded bg-white"
                            title={title || 'Insurance Document'}
                            style={{ minHeight: '400px' }}
                        />
                    </div>
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                        💡 PDF document loaded. If the preview doesn't appear, click the link above to open in a new tab. 
                        Some browsers may require you to download the PDF instead.
                    </div>
                </div>
            ) : isImageType ? (
                <div className="mt-2">
                    <img
                        src={gatewayURL}
                        alt={title || 'Insurance Document'}
                        className="max-w-md w-full rounded-lg border-2 border-gray-300 shadow-sm"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            const errorMsg = e.target.parentElement.querySelector('.error-msg');
                            if (errorMsg) errorMsg.style.display = 'block';
                        }}
                    />
                    <p className="text-xs text-gray-500 mt-2 error-msg hidden">
                        Image failed to load. Click the link above to view.
                    </p>
                </div>
            ) : (
                <div className="mt-3 p-3 bg-gray-50 border border-gray-300 rounded-lg">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm text-gray-700">
                            Document available. Click the link above to view.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

