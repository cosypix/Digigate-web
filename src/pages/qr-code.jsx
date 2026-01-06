import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

function QRCodeReactOnly({
    str1 = 'STRING_1',
    str2 = 'STRING_2',
    autoRefresh = true,
    refreshInterval = 5000,
}) {
    const [timestamp, setTimestamp] = useState(() => Date.now());
    const [dataUrl, setDataUrl] = useState('');

    useEffect(() => {
        const payloadObj = { guard_id: str1, place_id: str2, timestamp: timestamp };
        const payload = JSON.stringify(payloadObj);


        let cancelled = false;

        QRCode.toDataURL(payload, { errorCorrectionLevel: 'H' })
            .then((url) => {
                if (!cancelled) setDataUrl(url);
            })
            .catch((err) => {
                console.error('QR generation failed', err);
                if (!cancelled) setDataUrl('');
            });

        return () => {
            cancelled = true;
        };
    }, [timestamp, str1, str2]);

    useEffect(() => {
        if (!autoRefresh) return undefined;
        const id = setInterval(() => setTimestamp(Date.now()), refreshInterval);
        return () => clearInterval(id);
    }, [autoRefresh, refreshInterval]);


    const refreshTimestamp = () => setTimestamp(Date.now());

    const displayedPayload = JSON.stringify({ guard_id: str1, place_id: str2, timestamp: timestamp });


    return (
        <div style={{ display: 'inline-block', textAlign: 'center' }}>
            <div style={{ marginBottom: 8 }}>
                <strong>Payload (JSON)</strong>
                {/* <div style={{ fontFamily: 'monospace', marginTop: 4 }}>{displayedPayload}</div> */}
            </div>


            {dataUrl ? (
                <img src={dataUrl} alt="QR code" style={{ width: 220, height: 220 }} />
            ) : (
                <div>Generating QR...</div>
            )}


            <div style={{ marginTop: 8 }}>
                {/* <button onClick={refreshTimestamp}>Refresh timestamp</button> */}
            </div>
        </div>
    );
}

export default QRCodeReactOnly;