// HTML Elements
const scannerSection = document.getElementById('scanner-section');
const resultsSection = document.getElementById('results-section');
const scannerContainer = document.getElementById('scanner-container');
const loadingMessage = document.getElementById('loading-message');
const scanAgainBtn = document.getElementById('scan-again-btn');

// Result Elements
const productNameEl = document.getElementById('product-name');
const scoreDisplayEl = document.getElementById('score-display');
const ingredientsTextEl = document.getElementById('ingredients-text');

// Quagga Configuration
const quaggaConfig = {
    inputStream: {
        name: "Live",
        type: "LiveStream",
        target: scannerContainer,
        constraints: {
            width: 480, // Lower resolution for better performance on small box
            height: 480,
            facingMode: "environment"
        },
    },
    decoder: {
        readers: ["ean_reader", "upc_reader", "upc_e_reader"]
    }
};

// --- VIEW SWITCHING LOGIC ---

function showScannerView() {
    resultsSection.classList.add('hidden');
    scannerSection.classList.remove('hidden');
    
    // Reset scanner UI
    loadingMessage.classList.remove('hidden');
    scannerContainer.classList.add('hidden');
    
    startQuagga();
}

function showResultsView() {
    // Stop the camera to save battery and remove the video element
    Quagga.stop();
    
    scannerSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
}

// --- SCANNER LOGIC ---

function startQuagga() {
    Quagga.init(quaggaConfig, function(err) {
        if (err) {
            console.error('Quagga init failed:', err);
            loadingMessage.textContent = 'Error starting camera.';
            return;
        }
        
        console.log("Quagga ready.");
        loadingMessage.classList.add('hidden');
        scannerContainer.classList.remove('hidden');
        Quagga.start();
    });
}

Quagga.onDetected(function(result) {
    const barcode = result.codeResult.code;
    if (barcode) {
        console.log(`Barcode found: ${barcode}`);
        
        // Immediately switch views to stop scanning multiple times
        showResultsView();
        
        // Show placeholder data while fetching
        productNameEl.textContent = "Loading...";
        ingredientsTextEl.textContent = "Fetching details...";
        updateScoreUI(0); // Reset score color
        
        fetchProductData(barcode);
    }
});

scanAgainBtn.addEventListener('click', function() {
    showScannerView();
});

// --- DATA LOGIC ---

function calculateProcessedScore(product) {
    let score = 0;
    
    // Base Score from NOVA
    const novaGroup = product.nova_group;
    if (novaGroup === 1) score = 0;
    else if (novaGroup === 2) score = 20;
    else if (novaGroup === 3) score = 40;
    else if (novaGroup === 4) score = 60;
    else score = 10;

    // Ingredient Penalties
    const ingredients = (product.ingredients_text_with_allergens || "").toLowerCase();
    
    if (ingredients.includes('corn syrup')) score += 10;
    if (ingredients.includes('artificial flavor')) score += 5;
    if (ingredients.includes('artificial color')) score += 5;
    if (ingredients.includes('red 40') || ingredients.includes('yellow 5') || ingredients.includes('blue 1')) score += 5;
    if (ingredients.includes('hydrogenated')) score += 10;
    if (ingredients.includes('nitrite') || ingredients.includes('nitrate')) score += 7;

    // Nutritional Penalties
    const nutriments = product.nutriments || {};
    if ((nutriments.sugars_100g || 0) > 15) score += 5;
    if ((nutriments.sugars_100g || 0) > 25) score += 5;
    if ((nutriments.sodium_100g || 0) > 0.6) score += 5;

    if (score > 100) score = 100;
    return score;
}

function updateScoreUI(score) {
    scoreDisplayEl.classList.remove('score-low', 'score-medium', 'score-high');
    
    if (score === 0 && scoreDisplayEl.textContent === "?") {
        // Keep grey if resetting
        return;
    }

    if (score < 40) {
        scoreDisplayEl.classList.add('score-low');
    } else if (score < 70) {
        scoreDisplayEl.classList.add('score-medium');
    } else {
        scoreDisplayEl.classList.add('score-high');
    }
    scoreDisplayEl.textContent = `${score}%`;
}

function fetchProductData(barcode) {
    const apiUrl = `https://world.openfoodfacts.org/api/v2/product/${barcode}`;
    
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data.status === 1 && data.product) {
                const product = data.product;
                const processedScore = calculateProcessedScore(product);

                productNameEl.textContent = product.product_name || 'Name not found';
                ingredientsTextEl.textContent = product.ingredients_text || 'Ingredients not available.';
                updateScoreUI(processedScore);
            } else {
                alert("Product not found. Please try another.");
                showScannerView();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert("Network error.");
            showScannerView();
        });
}

// Start the app
showScannerView();