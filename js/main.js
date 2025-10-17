// This is the main function that will run our app's logic.
function startApp() {
    console.log("ZXing library is ready. Initializing the scanner.");

    // Get references to our HTML elements.
    const resultsUi = document.getElementById('results-ui');
    const productNameEl = document.getElementById('product-name');
    const scoreDisplayEl = document.getElementById('score-display');
    const ingredientsTextEl = document.getElementById('ingredients-text');
    const scannerContainer = document.getElementById('scanner-container');

    // This is the correct way to initialize the reader for a browser environment.
    const codeReader = new ZXing.BrowserMultiFormatReader();
    console.log('ZXing code reader initialized successfully.');

    // Start looking for a camera.
    codeReader.listVideoInputDevices()
        .then((videoInputDevices) => {
            if (videoInputDevices.length > 0) {
                // Use the rear camera if available.
                const selectedDeviceId = videoInputDevices[videoInputDevices.length - 1].deviceId;
                console.log(`Starting scan with device: ${selectedDeviceId}`);
                
                // Start decoding from the video device.
                codeReader.decodeFromVideoDevice(selectedDeviceId, 'video-element', (result, err) => {
                    if (result) {
                        // A barcode was found!
                        console.log(`Scan successful! Barcode: ${result.text}`);
                        codeReader.reset(); // Stop the camera.
                        scannerContainer.classList.add('hidden');
                        fetchProductData(result.text);
                    }
                });
            } else {
                console.error("No video input devices found.");
                alert("No camera found on this device.");
            }
        })
        .catch((err) => {
            console.error('Error initializing camera:', err);
            alert('Could not start camera. Please grant permission and refresh.');
        });
}

// This function acts as a gatekeeper. It checks if the ZXing library is loaded.
// If it's not ready, it waits 100 milliseconds and checks again.
function initialize() {
    if (typeof ZXing === 'undefined') {
        console.log('Waiting for ZXing library to load...');
        setTimeout(initialize, 100);
    } else {
        // The library is ready, so we can start our app.
        startApp();
    }
}

// Start the whole process.
initialize();


// This function fetches data from Open Food Facts (this part is unchanged).
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
                resultsUi.classList.remove('hidden');
            } else {
                alert(`Product not found for barcode: ${barcode}. Please try another product.`);
            }
        })
        .catch(error => {
            console.error('Fetch error:', error);
            alert('Could not connect to the database.');
        });
};