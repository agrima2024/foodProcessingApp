// js/main.js (Final Debugging Version)

document.addEventListener('DOMContentLoaded', () => {
    console.log("Page loaded. App is starting with new scanner.");

    const resultsUi = document.getElementById('results-ui');
    const productNameEl = document.getElementById('product-name');
    const scoreDisplayEl = document.getElementById('score-display');
    const ingredientsTextEl = document.getElementById('ingredients-text');
    const scannerContainer = document.getElementById('scanner-container');

    const onScanSuccess = (decodedText, decodedResult) => {
        console.log(`Scan successful! Barcode: ${decodedText}`);
        
        html5QrcodeScanner.clear().then(_ => {
            console.log("Scanner cleared.");
            fetchProductData(decodedText);
        }).catch(error => {
            console.error("Failed to clear scanner.", error);
        });
    };
    
    const onScanFailure = (error) => {
        // This is ignored with the verbose setting
    };
    
    // --- NEW: Define the formats we want to scan for ---
    const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
    ];

    // Create the scanner with the NEW configuration
    const html5QrcodeScanner = new Html5QrcodeScanner(
        "scanner-container",
        { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            // --- NEW: Add the formats configuration here ---
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
            formatsToSupport: formatsToSupport
        },
        /* verbose= */ true
    );
    
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);

    const fetchProductData = (barcode) => {
        // This function remains the same
        const apiUrl = `https://world.openfoodfacts.org/api/v2/product/${barcode}`;
        console.log(`Fetching data from: ${apiUrl}`);
        
        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (data.status === 1 && data.product) {
                    const product = data.product;
                    productNameEl.textContent = product.product_name || 'Name not found';
                    scoreDisplayEl.textContent = product.nova_group || '?';
                    ingredientsTextEl.textContent = product.ingredients_text || 'Ingredients not available.';

                    scannerContainer.classList.add('hidden');
                    resultsUi.classList.remove('hidden');
                } else {
                    alert(`Product not found for barcode: ${barcode}`);
                }
            })
            .catch(error => {
                console.error('Fetch error:', error);
                alert('Could not connect to the database.');
            });
    };
});