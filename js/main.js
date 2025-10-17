// Wait for the entire page, including external scripts, to load.
window.addEventListener('load', function () {
    console.log("Window fully loaded. Initializing the scanner application.");

    // Get references to all necessary HTML elements.
    const resultsUi = document.getElementById('results-ui');
    const productNameEl = document.getElementById('product-name');
    const scoreDisplayEl = document.getElementById('score-display');
    const ingredientsTextEl = document.getElementById('ingredients-text');
    const scannerContainer = document.getElementById('scanner-container');
    const loadingMessage = document.getElementById('loading-message');

    // Initialize the barcode reader.
    const codeReader = new ZXing.BrowserMultiFormatReader();
    console.log('ZXing code reader has been initialized.');

    // Start the process of finding and using the camera.
    codeReader.listVideoInputDevices()
        .then((videoInputDevices) => {
            if (videoInputDevices.length > 0) {
                // Choose the rear camera if available.
                const selectedDeviceId = videoInputDevices[videoInputDevices.length - 1].deviceId;
                console.log(`Starting scan with camera: ${selectedDeviceId}`);

                // Hide the loading message and show the scanner view.
                loadingMessage.classList.add('hidden');
                scannerContainer.classList.remove('hidden');

                // Start decoding from the camera.
                codeReader.decodeFromVideoDevice(selectedDeviceId, 'video-element', (result, err) => {
                    if (result) {
                        // A barcode was successfully decoded.
                        console.log(`Scan successful! Barcode: ${result.text}`);
                        codeReader.reset(); // Stop the camera.
                        scannerContainer.classList.add('hidden');
                        fetchProductData(result.text); // Fetch the product info.
                    }
                });
            } else {
                console.error("No video input devices found.");
                loadingMessage.textContent = "No camera found on this device.";
            }
        })
        .catch((err) => {
            console.error('Error initializing camera:', err);
            loadingMessage.textContent = 'Could not start camera. Please grant permission and refresh.';
        });
});

// This function fetches data from the Open Food Facts API.
function fetchProductData(barcode) {
    const apiUrl = `https://world.openfoodfacts.org/api/v2/product/${barcode}`;
    console.log(`Fetching data from: ${apiUrl}`);

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data.status === 1 && data.product) {
                const product = data.product;
                const resultsUi = document.getElementById('results-ui');
                document.getElementById('product-name').textContent = product.product_name || 'Name not found';
                document.getElementById('score-display').textContent = product.nova_group || '?';
                document.getElementById('ingredients-text').textContent = product.ingredients_text || 'Ingredients not available.';
                resultsUi.classList.remove('hidden');
            } else {
                alert(`Product not found for barcode: ${barcode}. Please try another product.`);
            }
        })
        .catch(error => {
            console.error('Fetch error:', error);
            alert('Could not connect to the database.');
        });
}