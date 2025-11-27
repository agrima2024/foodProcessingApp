// --- HTML Elements ---
const scannerSection = document.getElementById('scanner-section');
const resultsSection = document.getElementById('results-section');
const scannerContainer = document.getElementById('scanner-container');
const loadingMessage = document.getElementById('loading-message');
const scanAgainBtn = document.getElementById('scan-again-btn');

const productNameEl = document.getElementById('product-name');
const scoreDisplayEl = document.getElementById('score-display');
const ingredientsTextEl = document.getElementById('ingredients-text');

// NEW: Reference to the categories text element
const categoriesTextEl = document.getElementById('categories-text');

// --- STATE VARIABLES ---
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
    isProcessing = false;
    resultsSection.classList.add('hidden');
    scannerSection.classList.remove('hidden');
    loadingMessage.classList.remove('hidden');
    startQuagga();
}

function showResultsView() {
    scannerSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    Quagga.stop();
}

// --- SCANNER LOGIC ---

function startQuagga() {
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
    if (isProcessing) return;
    const barcode = result.codeResult.code;
    
    if (barcode) {
        console.log(`Barcode found: ${barcode}`);
        isProcessing = true;
        showResultsView();
        
        // Reset UI
        productNameEl.textContent = "Loading...";
        ingredientsTextEl.textContent = "Fetching...";
        categoriesTextEl.textContent = "Extracting tags..."; // Reset debug text
        updateScoreUI(0);
        
        fetchProductData(barcode);
    }
});

scanAgainBtn.addEventListener('click', showScannerView);


// --- SCORING LOGIC ---

function calculateProcessedScore(product) {
    let score = 0;
    const novaGroup = product.nova_group;
    
    if (novaGroup === 1) score = 0;
    else if (novaGroup === 2) score = 20;
    else if (novaGroup === 3) score = 40;
    else if (novaGroup === 4) score = 60;
    else score = 10;

    const ingredients = (product.ingredients_text_with_allergens || "").toLowerCase();
    if (ingredients.includes('corn syrup')) score += 10;
    if (ingredients.includes('artificial flavor')) score += 5;
    if (ingredients.includes('artificial color')) score += 5;
    if (ingredients.includes('hydrogenated')) score += 10;

    const nutriments = product.nutriments || {};
    if ((nutriments.sugars_100g || 0) > 15) score += 5;
    if ((nutriments.sodium_100g || 0) > 0.6) score += 5;

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

// --- DATA LOGIC ---

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

                // --- STEP 1: DISPLAY TAGS (DEBUGGING) ---
                if (product.categories_tags && product.categories_tags.length > 0) {
                    // 1. Get the raw tags (e.g., ["en:snacks", "en:salty-snacks"])
                    console.log("Raw Tags:", product.categories_tags);

                    // 2. Clean them up so they are readable
                    const readableTags = product.categories_tags.map(tag => 
                        tag.replace('en:', '').replace(/-/g, ' ')
                    );

                    // 3. Display them in the new box
                    categoriesTextEl.textContent = readableTags.join(', ');
                } else {
                    categoriesTextEl.textContent = "No category tags found for this product.";
                }

            } else {
                productNameEl.textContent = "Product Not Found";
                ingredientsTextEl.textContent = `No data for barcode: ${barcode}`;
                categoriesTextEl.textContent = "-";
                scoreDisplayEl.textContent = "?";
            }
        })
        .catch(error => {
            console.error('Error:', error);
            productNameEl.textContent = "Network Error";
        });
}

// Start the app
showScannerView();