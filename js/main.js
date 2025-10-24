// js/main.js

// Get references to all the HTML elements we need to control.
const resultsUi = document.getElementById('results-ui');
const productNameEl = document.getElementById('product-name');
const scoreDisplayEl = document.getElementById('score-display');
const ingredientsTextEl = document.getElementById('ingredients-text');
const scannerContainer = document.getElementById('scanner-container');
const loadingMessage = document.getElementById('loading-message');

// --- NEW: A function to calculate our custom processed score ---
function calculateProcessedScore(product) {
    let score = 0;

    // 1. Start with a base score from the NOVA group.
    const novaGroup = product.nova_group;
    if (novaGroup === 1) score = 0;
    else if (novaGroup === 2) score = 20;
    else if (novaGroup === 3) score = 40;
    else if (novaGroup === 4) score = 60;
    else score = 10; // Default for unknown

    // 2. Add penalty points for "red flag" ingredients.
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

    // 3. Add penalty points for high sugar or salt from nutriments.
    const nutriments = product.nutriments || {};
    const sugarPer100g = nutriments.sugars_100g || 0;
    const sodiumPer100g = nutriments.sodium_100g || 0;

    if (sugarPer100g > 15) score += 5; // Over 15g sugar per 100g
    if (sugarPer100g > 25) score += 5; // Over 25g
    if (sodiumPer100g > 0.6) score += 5; // Over 600mg sodium per 100g
    if (sodiumPer100g > 1.5) score += 5; // Over 1500mg

    // 4. Cap the score at 100.
    if (score > 100) score = 100;

    return score;
}

// This function updates the color of the score circle.
function updateScoreUI(score) {
    // Remove any old color classes
    scoreDisplayEl.classList.remove('score-low', 'score-medium', 'score-high');

    // Add the new color class based on the score
    if (score < 40) {
        scoreDisplayEl.classList.add('score-low');
    } else if (score < 70) {
        scoreDisplayEl.classList.add('score-medium');
    } else {
        scoreDisplayEl.classList.add('score-high');
    }

    // Set the text
    scoreDisplayEl.textContent = `${score}%`;
}

// Configuration for Quagga
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

// Initialize Quagga
Quagga.init(quaggaConfig, function(err) {
    if (err) {
        console.error('Quagga initialization failed:', err);
        loadingMessage.textContent = 'Error starting camera. Please grant permission.';
        return;
    }
    console.log("Quagga initialization finished. Ready to start.");
    loadingMessage.classList.add('hidden');
    scannerContainer.classList.remove('hidden');
    Quagga.start();
});

// Set up the listener for when a barcode is detected
Quagga.onDetected(function(result) {
    const barcode = result.codeResult.code;
    if (barcode) {
        console.log(`Scan successful! Barcode: ${barcode}`);
        Quagga.stop();
        scannerContainer.classList.add('hidden');
        fetchProductData(barcode);
    }
});

// This function fetches and displays the data.
function fetchProductData(barcode) {
    const apiUrl = `https://world.openfoodfacts.org/api/v2/product/${barcode}`;
    console.log(`Fetching data from: ${apiUrl}`);

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data.status === 1 && data.product) {
                // --- THIS SECTION IS UPDATED ---
                const product = data.product;
                
                // 1. Calculate the new score
                const processedScore = calculateProcessedScore(product);

                // 2. Update the UI
                resultsUi.classList.remove('hidden');
                productNameEl.textContent = product.product_name || 'Name not found';
                ingredientsTextEl.textContent = product.ingredients_text_with_allergens || 'Ingredients not available.';
                
                // 3. Update the score circle (text and color)
                updateScoreUI(processedScore);

            } else {
                alert(`Product not found for barcode: ${barcode}. Please try another product.`);
            }
        })
        .catch(error => {
            console.error('Fetch error:', error);
            alert('Could not connect to the database.');
        });
}