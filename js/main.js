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
        ingredientsTextEl.textContent = "Fetching details...";
        alternativesContainer.innerHTML = "";
        alternativesSection.classList.add('hidden');
        updateScoreUI(null); // Reset to Grey
        
        fetchProductData(barcode);
    }
});

scanAgainBtn.addEventListener('click', showScannerView);


// --- SCORING LOGIC ---

function calculateProcessedScore(product) {
    // CRITICAL FIX: Check if data exists first!
    // If we have no NOVA group AND no ingredients text, we cannot score this product.
    if (!product.nova_group && !product.ingredients_text) {
        return null; // Return null to signal "Unknown"
    }

    let score = 0;
    const novaGroup = product.nova_group;
    
    // Base Score
    if (novaGroup === 1) score = 0;
    else if (novaGroup === 2) score = 20;
    else if (novaGroup === 3) score = 40;
    else if (novaGroup === 4) score = 60;
    else score = 10; // Default if NOVA is missing but ingredients exist

    // Ingredients
    const ingredients = (product.ingredients_text_with_allergens || "").toLowerCase();
    if (ingredients.includes('corn syrup')) score += 10;
    if (ingredients.includes('artificial flavor')) score += 5;
    if (ingredients.includes('artificial color')) score += 5;
    if (ingredients.includes('hydrogenated')) score += 10;

    // Nutriments
    const nutriments = product.nutriments || {};
    if ((nutriments.sugars_100g || 0) > 15) score += 5;
    if ((nutriments.sodium_100g || 0) > 0.6) score += 5;

    if (score > 100) score = 100;
    return score;
}

function updateScoreUI(score) {
    // Remove all color classes to reset
    scoreDisplayEl.classList.remove('score-low', 'score-medium', 'score-high');
    
    // HANDLE NULL (Missing Data)
    if (score === null) {
        scoreDisplayEl.textContent = "?";
        // It will stay the default grey color defined in CSS
        return;
    }

    if (score < 40) scoreDisplayEl.classList.add('score-low');
    else if (score < 70) scoreDisplayEl.classList.add('score-medium');
    else scoreDisplayEl.classList.add('score-high');
    
    scoreDisplayEl.textContent = `${score}%`;
}

// --- ALTERNATIVES SEARCH ---

function fetchSimilarProducts(categoryTag, currentNova) {
    const searchUrl = `https://world.openfoodfacts.org/api/v2/search?categories_tags_en=${categoryTag}&nova_groups=1,2,3&sort_by=unique_scans_n&page_size=3&fields=product_name,image_front_small_url,nova_group,nutrition_grades_tags`;

    fetch(searchUrl)
        .then(response => response.json())
        .then(data => {
            if (data.products && data.products.length > 0) {
                alternativesContainer.innerHTML = "";
                data.products.forEach(product => {
                    const card = document.createElement('div');
                    card.className = 'alt-card';
                    
                    let novaColor = '#4CAF50'; 
                    if(product.nova_group === 3) novaColor = '#ffc107'; 

                    card.innerHTML = `
                        <img src="${product.image_front_small_url || 'https://via.placeholder.com/50'}" class="alt-image" alt="Product">
                        <div class="alt-info">
                            <div class="alt-name">${product.product_name || 'Unknown Product'}</div>
                            <div class="alt-score" style="color: ${novaColor}">
                                Better Choice (NOVA ${product.nova_group || '?'})
                            </div>
                        </div>
                    `;
                    alternativesContainer.appendChild(card);
                });
                alternativesSection.classList.remove('hidden');
            }
        })
        .catch(err => console.error("Error fetching alternatives:", err));
}


// --- DATA LOGIC ---

function fetchProductData(barcode) {
    const apiUrl = `https://world.openfoodfacts.org/api/v2/product/${barcode}`;
    
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data.status === 1 && data.product) {
                const product = data.product;
                
                // 1. Calculate Score (Now handles null)
                const processedScore = calculateProcessedScore(product);

                // 2. Update Text
                productNameEl.textContent = product.product_name || 'Name not found';
                
                // If ingredients are missing, tell the user explicitly
                if (!product.ingredients_text) {
                    ingredientsTextEl.textContent = "⚠️ Ingredient data missing from database.";
                    ingredientsTextEl.style.color = "#e74c3c"; // Make warning red
                } else {
                    ingredientsTextEl.textContent = product.ingredients_text;
                    ingredientsTextEl.style.color = "#444"; // Reset color
                }

                // 3. Update Score Bubble
                updateScoreUI(processedScore);

                // 4. Trigger Search (Only if we have a category)
                if (product.categories_tags && product.categories_tags.length > 0) {
                    const category = product.categories_tags[product.categories_tags.length - 1];
                    // Even if the current product has no data, we can still suggest popular items in that category
                    fetchSimilarProducts(category, product.nova_group);
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