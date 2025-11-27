// Get references to all the HTML elements
const resultsUi = document.getElementById('results-ui');
const productNameEl = document.getElementById('product-name');
const scoreDisplayEl = document.getElementById('score-display');
const ingredientsTextEl = document.getElementById('ingredients-text');
const scannerContainer = document.getElementById('scanner-container');
const loadingMessage = document.getElementById('loading-message');
const scanAgainBtn = document.getElementById('scan-again-btn'); // NEW reference

// 1. Configuration for Quagga
const quaggaConfig = {
    inputStream: {
        name: "Live",
        type: "LiveStream",
        target: scannerContainer,
        constraints: {
            width: 640,
            height: 480,
            facingMode: "environment"
        },
    },
    decoder: {
        readers: ["ean_reader", "upc_reader", "upc_e_reader"]
    }
};

// 2. Function to Initialize and Start the Scanner
function startScanner() {
    // Reset UI: Show loading, hide scanner (until ready), hide results
    loadingMessage.classList.remove('hidden');
    scannerContainer.classList.add('hidden');
    resultsUi.classList.add('hidden');

    Quagga.init(quaggaConfig, function(err) {
        if (err) {
            console.error('Quagga initialization failed:', err);
            loadingMessage.textContent = 'Error starting camera. Please grant permission.';
            return;
        }
        
        console.log("Quagga initialization finished. Ready to start.");
        
        // UI Update: Hide loading, show scanner
        loadingMessage.classList.add('hidden');
        scannerContainer.classList.remove('hidden');
        
        Quagga.start();
    });
}

// 3. Listen for Barcode Detection
Quagga.onDetected(function(result) {
    const barcode = result.codeResult.code;
    
    // Check if a barcode was actually found
    if (barcode) {
        console.log(`Scan successful! Barcode: ${barcode}`);
        
        // Stop the scanner immediately
        Quagga.stop();
        
        // Hide the scanner container immediately (gets rid of the camera square)
        scannerContainer.classList.add('hidden');
        
        // Fetch the data
        fetchProductData(barcode);
    }
});

// 4. NEW: Listen for the "Scan Again" button click
scanAgainBtn.addEventListener('click', function() {
    startScanner();
});

// 5. Start the scanner automatically when the page loads
startScanner();


// --- Helper Functions ---

function calculateProcessedScore(product) {
    let score = 0;
    const novaGroup = product.nova_group;
    if (novaGroup === 1) score = 0;
    else if (novaGroup === 2) score = 20;
    else if (novaGroup === 3) score = 40;
    else if (novaGroup === 4) score = 60;
    else score = 10;

    const ingredients = product.ingredients_text_with_allergens || "";
    const lowerCaseIngredients = ingredients.toLowerCase();

    if (lowerCaseIngredients.includes('corn syrup')) score += 10;
    if (lowerCaseIngredients.includes('artificial flavor')) score += 5;
    if (lowerCaseIngredients.includes('artificial color')) score += 5;
    if (lowerCaseIngredients.includes('red 40')) score += 3;
    if (lowerCaseIngredients.includes('yellow 5')) score += 3;
    if (lowerCaseIngredients.includes('blue 1')) score += 3;
    if (lowerCaseIngredients.includes('hydrogenated oil')) score += 10;
    if (lowerCaseIngredients.includes('sodium nitrite')) score += 7;

    const nutriments = product.nutriments || {};
    const sugarPer100g = nutriments.sugars_100g || 0;
    const sodiumPer100g = nutriments.sodium_100g || 0;

    if (sugarPer100g > 15) score += 5;
    if (sugarPer100g > 25) score += 5;
    if (sodiumPer100g > 0.6) score += 5;
    if (sodiumPer100g > 1.5) score += 5;

    if (score > 100) score = 100;
    return score;
}

function updateScoreUI(score) {
    scoreDisplayEl.classList.remove('score-low', 'score-medium', 'score-high');
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
    console.log(`Fetching data from: ${apiUrl}`);

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data.status === 1 && data.product) {
                const product = data.product;
                const processedScore = calculateProcessedScore(product);

                // Update UI elements
                productNameEl.textContent = product.product_name || 'Name not found';
                ingredientsTextEl.textContent = product.ingredients_text_with_allergens || 'Ingredients not available.';
                updateScoreUI(processedScore);
                
                // Show the results
                resultsUi.classList.remove('hidden');

            } else {
                alert(`Product not found for barcode: ${barcode}. Please try another product.`);
                // If not found, restart scanner so user isn't stuck
                startScanner();
            }
        })
        .catch(error => {
            console.error('Fetch error:', error);
            alert('Could not connect to the database.');
            startScanner();
        });
}