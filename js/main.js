// --- HTML Elements ---
const scannerSection = document.getElementById('scanner-section');
const resultsSection = document.getElementById('results-section');
const scannerContainer = document.getElementById('scanner-container');
const loadingMessage = document.getElementById('loading-message');
const scanAgainBtn = document.getElementById('scan-again-btn');

const productNameEl = document.getElementById('product-name');
const scoreDisplayEl = document.getElementById('score-display');
const ingredientsTextEl = document.getElementById('ingredients-text');
const alternativesSection = document.getElementById('alternatives-section');
const alternativesContainer = document.getElementById('alternatives-container');

// --- STATE VARIABLES ---
// We use this to prevent double-scanning
let isProcessing = false;

// --- CONFIGURATION ---
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

// --- VIEW LOGIC ---

function showScannerView() {
    isProcessing = false; // Reset the lock so we can scan again

    // Switch Screens
    resultsSection.classList.add('hidden');
    scannerSection.classList.remove('hidden');
    
    // Reset UI
    loadingMessage.classList.remove('hidden');
    
    // Start Camera
    startQuagga();
}

function showResultsView() {
    // Switch Screens
    scannerSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');

    // Stop Camera immediately
    Quagga.stop();
}

// --- SCANNER LOGIC ---

function startQuagga() {
    // Wait a tiny bit to ensure the container is rendered
    setTimeout(() => {
        Quagga.init(quaggaConfig, function(err) {
            if (err) {
                console.error('Quagga init failed:', err);
                loadingMessage.textContent = 'Camera Error: Please allow permissions.';
                return;
            }
            console.log("Quagga ready.");
            loadingMessage.classList.add('hidden');
            Quagga.start();
        });
    }, 100);
}

Quagga.onDetected(function(result) {
    // If we are already busy processing a scan, ignore new detections
    if (isProcessing) return;

    const barcode = result.codeResult.code;
    
    if (barcode) {
        console.log(`Barcode found: ${barcode}`);
        isProcessing = true; // Lock the scanner
        
        // Go to results page immediately
        showResultsView();
        
        // Show "Loading" state
        productNameEl.textContent = "Loading...";
        ingredientsTextEl.textContent = "Fetching product details...";
        updateScoreUI(0);
        alternativesSection.classList.add('hidden');
        alternativesContainer.innerHTML = "";
        
        // Get the real data
        fetchProductData(barcode);
    }
});

// Button Click Event
scanAgainBtn.addEventListener('click', showScannerView);


// --- API & SCORING LOGIC ---

function calculateProcessedScore(product) {
    let score = 0;
    const novaGroup = product.nova_group;
    
    // Base Score
    if (novaGroup === 1) score = 0;
    else if (novaGroup === 2) score = 20;
    else if (novaGroup === 3) score = 40;
    else if (novaGroup === 4) score = 60;
    else score = 10;

    // Ingredients Analysis
    const ingredients = (product.ingredients_text_with_allergens || "").toLowerCase();
    if (ingredients.includes('corn syrup')) score += 10;
    if (ingredients.includes('artificial flavor')) score += 5;
    if (ingredients.includes('artificial color')) score += 5;
    if (ingredients.includes('red 40') || ingredients.includes('yellow 5') || ingredients.includes('blue 1')) score += 5;
    if (ingredients.includes('hydrogenated')) score += 10;
    if (ingredients.includes('nitrite') || ingredients.includes('nitrate')) score += 7;

    // Nutritional Analysis
    const nutriments = product.nutriments || {};
    if ((nutriments.sugars_100g || 0) > 15) score += 5;
    if ((nutriments.sodium_100g || 0) > 0.6) score += 5; // 600mg

    if (score > 100) score = 100;
    return score;
}

function updateScoreUI(score) {
    scoreDisplayEl.classList.remove('score-low', 'score-medium', 'score-high');
    
    if (score === 0 && scoreDisplayEl.textContent === "?") return;

    if (score < 40) scoreDisplayEl.classList.add('score-low');
    else if (score < 70) scoreDisplayEl.classList.add('score-medium');
    else scoreDisplayEl.classList.add('score-high');
    
    scoreDisplayEl.textContent = `${score}%`;
}

function fetchAlternatives(categoryTag) {
    if (!categoryTag) return;

    // Search for A/B Nutri-Score items in the same category
    const searchUrl = `https://world.openfoodfacts.org/api/v2/search?categories_tags_en=${categoryTag}&nutrition_grades_tags=a,b&sort_by=unique_scans_n&page_size=3&fields=product_name,code,image_front_small_url,nutrition_grades_tags`;

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
        .catch(console.error);
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

                if (product.categories_tags && product.categories_tags.length > 0) {
                    const category = product.categories_tags[product.categories_tags.length - 1];
                    fetchAlternatives(category);
                }
            } else {
                // BUG FIX: Instead of alerting and resetting, we just show the error on the Results page.
                // This prevents the "scan again loop" you were seeing.
                productNameEl.textContent = "Product Not Found";
                ingredientsTextEl.textContent = `Sorry, we couldn't find data for barcode: ${barcode}`;
                scoreDisplayEl.textContent = "?";
            }
        })
        .catch(error => {
            console.error('Error:', error);
            productNameEl.textContent = "Network Error";
            ingredientsTextEl.textContent = "Please check your internet connection.";
        });
}

// Start the app
showScannerView();