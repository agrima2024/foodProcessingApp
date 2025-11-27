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

// --- VIEW SWITCHING ---

function showScannerView() {
    resultsSection.classList.add('hidden');
    scannerSection.classList.remove('hidden');
    loadingMessage.classList.remove('hidden');
    scannerContainer.classList.add('hidden');
    startQuagga();
}

function showResultsView() {
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
        showResultsView();
        
        // Reset UI
        productNameEl.textContent = "Loading...";
        ingredientsTextEl.textContent = "Fetching details...";
        alternativesSection.classList.add('hidden'); // Hide alts until loaded
        alternativesContainer.innerHTML = ""; // Clear old alts
        updateScoreUI(0);
        
        fetchProductData(barcode);
    }
});

scanAgainBtn.addEventListener('click', showScannerView);

// --- DATA LOGIC ---

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

// --- NEW: Fetch "Better" Alternatives ---
function fetchAlternatives(categoryTag) {
    if (!categoryTag) return;

    // Search for products in the SAME category but with Nutri-Score 'a' or 'b'
    const searchUrl = `https://world.openfoodfacts.org/api/v2/search?categories_tags_en=${categoryTag}&nutrition_grades_tags=a,b&sort_by=unique_scans_n&page_size=3&fields=product_name,code,image_front_small_url,nutrition_grades_tags`;

    console.log(`Searching alternatives for category: ${categoryTag}`);

    fetch(searchUrl)
        .then(response => response.json())
        .then(data => {
            if (data.products && data.products.length > 0) {
                alternativesContainer.innerHTML = ""; // Clear placeholders
                
                data.products.forEach(product => {
                    // Create HTML for each alternative card
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
                
                alternativesSection.classList.remove('hidden'); // Show the section
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

                // --- TRIGGER ALTERNATIVES SEARCH ---
                // We use the first category tag found to find similar items
                if (product.categories_tags && product.categories_tags.length > 0) {
                    // Get the main category (often the last one is most specific)
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