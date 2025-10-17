document.addEventListener('DOMContentLoaded', () => {
    console.log("Page loaded. Initializing Zxing-js Scanner.");

    const resultsUi = document.getElementById('results-ui');
    const productNameEl = document.getElementById('product-name');
    const scoreDisplayEl = document.getElementById('score-display');
    const ingredientsTextEl = document.getElementById('ingredients-text');
    const scannerContainer = document.getElementById('scanner-container');
    const videoElement = document.getElementById('video-element');

    // Create a new barcode reader instance
    const codeReader = new ZXing.BrowserMultiFormatReader();
    console.log('ZXing code reader initialized');

    // Start scanning when the page loads
    startScanning();

    function startScanning() {
        // Find all available video cameras
        codeReader.listVideoInputDevices()
            .then((videoInputDevices) => {
                // Use the last camera in the list (usually the rear one on a phone)
                const selectedDeviceId = videoInputDevices[videoInputDevices.length - 1].deviceId;
                
                console.log(`Starting scan with device: ${selectedDeviceId}`);
                
                // Start decoding from the camera
                codeReader.decodeFromVideoDevice(selectedDeviceId, 'video-element', (result, err) => {
                    // This function is called for every frame the camera captures
                    if (result) {
                        // A barcode was successfully found!
                        console.log(`Scan successful! Barcode: ${result.text}`);
                        
                        // Stop the camera and scanning process
                        codeReader.reset();
                        
                        // Hide the scanner and fetch the product data
                        scannerContainer.classList.add('hidden');
                        fetchProductData(result.text);
                    }
                    if (err && !(err instanceof ZXing.NotFoundException)) {
                        // Log any errors except for the common "NotFoundException"
                        console.error('ZXing decoding error:', err);
                    }
                });
            })
            .catch((err) => {
                console.error('Error listing video devices:', err);
                alert('Could not start the camera. Please grant permission and refresh the page.');
            });
    }

    // This function fetches data from the Open Food Facts API
    const fetchProductData = (barcode) => {
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

                    // Show the results section
                    resultsUi.classList.remove('hidden');
                } else {
                    alert(`Product not found for barcode: ${barcode}. Please try another product.`);
                }
            })
            .catch(error => {
                console.error('Fetch error:', error);
                alert('Could not connect to the database. Please check your internet connection.');
            });
    };
});