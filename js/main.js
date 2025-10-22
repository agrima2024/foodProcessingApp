// Get references to all the HTML elements we need to control.
const resultsUi = document.getElementById('results-ui');
const productNameEl = document.getElementById('product-name');
const scoreDisplayEl = document.getElementById('score-display');
const ingredientsTextEl = document.getElementById('ingredients-text');
const scannerContainer = document.getElementById('scanner-container');
const loadingMessage = document.getElementById('loading-message');

// Configuration for Quagga
const quaggaConfig = {
    inputStream: {
        name: "Live",
        type: "LiveStream",
        target: scannerContainer, // Render the video stream into this element
        constraints: {
            width: 640,
            height: 480,
            facingMode: "environment" // Use the rear camera
        },
    },
    decoder: {
        // We specify only the formats we care about
        readers: [
            "ean_reader",
            "upc_reader",
            "upc_e_reader"
        ]
    }
};

// Initialize Quagga
Quagga.init(quaggaConfig, function(err) {
    if (err) {
        console.error('Quagga initialization failed:', err);
        loadingMessage.textContent = 'Error starting camera. Please grant permission.';
        return;
    }
    
    console.log("Quagga initialization finished. Ready to start.");
    
    // Hide the loading message and show the scanner
    loadingMessage.classList.add('hidden');
    scannerContainer.classList.remove('hidden');
    
    // Start the scanner
    Quagga.start();
});

// Set up the listener for when a barcode is detected
Quagga.onDetected(function(result) {
    const barcode = result.codeResult.code;
    
    // Make sure we have a valid barcode and haven't just scanned the same one
    if (barcode) {
        console.log(`Scan successful! Barcode: ${barcode}`);
        
        // Stop the scanner
        Quagga.stop();
        
        // Hide the scanner and fetch data
        scannerContainer.classList.add('hidden');
        fetchProductData(barcode);
    }
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
                resultsUi.classList.remove('hidden');
                productNameEl.textContent = product.product_name || 'Name not found';
                scoreDisplayEl.textContent = data.product.nova_group || '?';
                ingredientsTextEl.textContent = product.ingredients_text || 'Ingredients not available.';
            } else {
                alert(`Product not found for barcode: ${barcode}. Please try another product.`);
            }
        })
        .catch(error => {
            console.error('Fetch error:', error);
            alert('Could not connect to the database.');
        });
}