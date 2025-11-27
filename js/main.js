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
const alternativesSection = document.getElementById('alternatives-section');
const alternativesContainer = document.getElementById('alternatives-container');

// Quagga Configuration
const quaggaConfig = {
    inputStream: {
        name: "Live",
        type: "LiveStream",
        target: scannerContainer,
        constraints: {
            width: 480,
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
    
    // Show loading message
    loadingMessage.classList.remove('hidden');
    
    // CRITICAL FIX: The container MUST be visible for Quagga to initialize
    // We remove the 'hidden' class immediately.
    scannerContainer.classList.remove('hidden');
    
    startQuagga();
}

function showResultsView() {
    // Stop the camera to save battery
    Quagga.stop();
    
    scannerSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
}

// --- SCANNER LOGIC ---

function startQuagga() {
    // Check if Quagga is already running to prevent errors
    // (We wrap init in a short timeout to let the DOM render the visible box)
    setTimeout(() => {
        Quagga.init(quaggaConfig, function(err) {
            if (err) {
                console.error('Quagga init failed:', err);
                loadingMessage.textContent = 'Error starting camera. Please grant permission.';
                return;
            }
            
            console.log("Quagga ready.");
            // Hide the loading text now that the camera is ready
            loadingMessage.classList.add('hidden');
            Quagga.start();
        });
    }, 100);
}

Quagga.onDetected(function(result) {
    const barcode = result.codeResult.code;
    
    // Quagga can sometimes trigger multiple times rapidly, so we verify we have a code
    // and check if we are currently looking for one (scanner section is visible)
    if (barcode && !scannerSection.classList.contains('hidden')) {
        console.log(`Barcode found: ${barcode}`);
        
        // Switch views immediately
        showResultsView();
        
        // Reset UI data
        productNameEl.textContent = "Loading...";
        ingredientsTextEl.textContent = "Fetching details...";
        alternativesSection.classList.add('hidden');
        alternativesContainer.innerHTML = "";
        updateScoreUI(0);
        
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
    if ((nutriments.sodium_100g || 0) > 0.6) score += 5;

    if (score > 100) score = 100;
    return score;
}

function updateScoreUI(score) {
    scoreDisplayEl.classList.remove('score-low', 'score-medium', 'score-high');
    
    if (score === 0 && scoreDisplayEl.textContent === "?") {
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

// --- ALTERNATIVES SEARCH ---
function fetchAlternatives(categoryTag) {
    if (!categoryTag) return;

    // Search for products in the SAME category with Nutri-Score A or B
    const searchUrl = `https://world.openfoodfacts.org/api/v2/search?categories_tags_en=${categoryTag}&nutrition_grades_tags=a,b&sort_by=unique_scans_n&page_size=3&fields=product_name,code,image_front_small_url,nutrition_grades_tags`;

    console.log(`Searching alternatives for category: ${categoryTag}`);

    fetch(searchUrl)
        .then(response => response.json())
        .then(data => {
            if (data.products && data.products.length > 0) {
                alternativesContainer.innerHTML = "";
                
                data.products.forEach(product => {
                    const card = document.createElement('div');
                    card.className = 'alt-card';
                    card.innerHTML = `
                        <img src="${product.image_front_small_url || 'https://via.placeholder.com/50'}" class="alt-image" alt="${product.product_name}">
                        <div class="alt-info">
                            <div class="alt-name">${product.product_name || 'Unknown Product'}</div>
                            <div class="alt-score">Nutri-Score: ${product.nutrition_grades_tags ? product.nutrition_grades_tags[0].toUpperCase() : '?'}</div>
                        </div>
                    `;
                    alternativesContainer.appendChild(card);
                });
                
                alternativesSection.classList.remove('hidden');
            }
        })
        .catch(err => console.error("Error fetching alternatives:", err));
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

                // Trigger Alternatives Search
                if (product.categories_tags && product.categories_tags.length > 0) {
                    const category = product.categories_tags[product.categories_tags.length - 1];
                    fetchAlternatives(category);
                }

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