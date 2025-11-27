// --- HTML Elements ---
const scannerSection = document.getElementById('scanner-section');
const resultsSection = document.getElementById('results-section');
const scannerContainer = document.getElementById('scanner-container');
const loadingMessage = document.getElementById('loading-message');
const scanAgainBtn = document.getElementById('scan-again-btn');

const productNameEl = document.getElementById('product-name');
const scoreDisplayEl = document.getElementById('score-display');
const ingredientsTextEl = document.getElementById('ingredients-text');

// NEW elements for this step
const categoryDebugText = document.getElementById('category-debug-text');
const alternativesSection = document.getElementById('alternatives-section');
const alternativesContainer = document.getElementById('alternatives-container');

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
        categoryDebugText.textContent = "...";
        alternativesContainer.innerHTML = ""; // Clear old products
        alternativesSection.classList.add('hidden');
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

// --- NEW: STEP 2 - Fetch Similar Products ---

function fetchSimilarProducts(categoryTag) {
    // We search for 5 products in the same category
    // We ask for specific fields: product_name, image, and nova_group
    const searchUrl = `https://world.openfoodfacts.org/api/v2/search?categories_tags_en=${categoryTag}&page_size=5&fields=product_name,image_front_small_url,nova_group`;

    console.log(`Fetching similar products for: ${categoryTag}`);

    fetch(searchUrl)
        .then(response => response.json())
        .then(data => {
            if (data.products && data.products.length > 0) {
                
                // Clear the container
                alternativesContainer.innerHTML = "";

                // Loop through the results and create cards
                data.products.forEach(product => {
                    const card = document.createElement('div');
                    card.className = 'alt-card';
                    
                    // HTML for the product card
                    card.innerHTML = `
                        <img src="${product.image_front_small_url || 'https://via.placeholder.com/50'}" class="alt-image" alt="Product Image">
                        <div class="alt-info">
                            <div class="alt-name">${product.product_name || 'Unknown Product'}</div>
                            <div class="alt-score">NOVA Group: ${product.nova_group || '?'}</div>
                        </div>
                    `;
                    
                    alternativesContainer.appendChild(card);
                });

                // Show the section
                alternativesSection.classList.remove('hidden');
            } else {
                categoryDebugText.textContent += " (No similar products found)";
            }
        })
        .catch(err => console.error("Error fetching similar products:", err));
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

                // --- LOGIC FOR STEP 2 ---
                if (product.categories_tags && product.categories_tags.length > 0) {
                    
                    // 1. Pick the LAST tag (usually the most specific)
                    const bestCategory = product.categories_tags[product.categories_tags.length - 1];
                    
                    // 2. Display it for debugging
                    categoryDebugText.textContent = bestCategory.replace('en:', '').replace(/-/g, ' ');

                    // 3. Fetch similar products
                    fetchSimilarProducts(bestCategory);
                } else {
                    categoryDebugText.textContent = "No categories found";
                }

            } else {
                productNameEl.textContent = "Product Not Found";
                ingredientsTextEl.textContent = `No data for barcode: ${barcode}`;
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