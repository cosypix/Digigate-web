import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';


/*
QRCodeReactOnly + Example App


What this file is:
- A compact React-only component `QRCodeReactOnly` that generates a QR whose CONTENT IS JSON.
- An example `App` component that shows "Hello World" and embeds the QR component.


How to use:
1. Install dependency inside your React project: `npm install qrcode` (or `yarn add qrcode`).
2. Replace your existing `src/App.jsx` with this file --- or copy the `QRCodeReactOnly` component into
`src/components/QRCodeReactOnly.jsx` and import it into your existing page that contains "Hello World".
3. Run your React app (`npm start` / `yarn start`).


Notes:
- The QR payload is JSON: { "ts": <timestamp-ms>, "a": <str1>, "b": <str2> }
- Scanning the QR will yield that JSON string (you can parse it on the scanner side).
*/


// -------------------- QRCodeReactOnly component --------------------
function QRCodeReactOnly({
    str1 = 'STRING_1',
    str2 = 'STRING_2',
    autoRefresh = true,
    refreshInterval = 5000,
}) {
    // timestamp in milliseconds
    const [timestamp, setTimestamp] = useState(() => Date.now());


    // holds generated image data URL
    const [dataUrl, setDataUrl] = useState('');


    // generate the QR whenever timestamp/str1/str2 change
    useEffect(() => {
        // Build a JSON payload (stringified) so scanners receive JSON
        const payloadObj = { guard_id: str1, place_id: str2, timestamp: timestamp };
        const payload = JSON.stringify(payloadObj);


        let cancelled = false;


        // Convert to PNG data URL (browser-friendly)
        QRCode.toDataURL(payload, { errorCorrectionLevel: 'H' })
            .then((url) => {
                if (!cancelled) setDataUrl(url);
            })
            .catch((err) => {
                console.error('QR generation failed', err);
                if (!cancelled) setDataUrl('');
            });


        // cleanup if component unmounts before promise resolves
        return () => {
            cancelled = true;
        };
    }, [timestamp, str1, str2]);


    // optional auto-refresh interval
    useEffect(() => {
        if (!autoRefresh) return undefined;
        const id = setInterval(() => setTimestamp(Date.now()), refreshInterval);
        return () => clearInterval(id);
    }, [autoRefresh, refreshInterval]);


    const refreshTimestamp = () => setTimestamp(Date.now());


    // Render: show the JSON payload and the QR image
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