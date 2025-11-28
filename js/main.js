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
            width: { min: 640, ideal: 1280, max: 1920 }, // Allow higher res for better focus
            height: { min: 480, ideal: 720, max: 1080 },
            facingMode: "environment" // Use the rear camera
        },
    },
    // TUNING: These settings help finding barcodes in messy images
    locator: {
        patchSize: "medium",
        halfSample: true
    },
    numOfWorkers: 2, // Use more processing power
    decoder: {
        readers: ["ean_reader", "upc_reader", "upc_e_reader"] // standard retail codes
    },
    locate: true // Help find the barcode box
};

// --- VIEW LOGIC ---

function showScannerView() {
    isProcessing = false;
    resultsSection.classList.add('hidden');
    scannerSection.classList.remove('hidden');
    
    loadingMessage.classList.remove('hidden');
    scannerContainer.classList.remove('hidden');
    
    startQuagga();
}

function showResultsView() {
    Quagga.stop(); // Stop camera immediately
    scannerSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
}

// --- SCANNER LOGIC ---

function startQuagga() {
    // Wait for DOM to render
    setTimeout(() => {
        Quagga.init(quaggaConfig, function(err) {
            if (err) {
                console.error('Quagga init failed:', err);
                loadingMessage.textContent = 'Camera Error. Please ensure you are on HTTPS and allowed permissions.';
                return;
            }
            console.log("Quagga ready.");
            loadingMessage.classList.add('hidden');
            Quagga.start();
        });
    }, 100);
}

Quagga.onDetected(function(result) {
    // Prevent double-scanning
    if (isProcessing) return;

    const barcode = result.codeResult.code;
    
    // Ensure we are in the scanner view before accepting a code
    if (barcode && !scannerSection.classList.contains('hidden')) {
        console.log(`Barcode found: ${barcode}`);
        isProcessing = true;
        
        showResultsView();
        
        // Reset UI
        productNameEl.textContent = "Loading...";
        ingredientsTextEl.textContent = "Fetching details...";
        ingredientsTextEl.style.color = "#444"; 
        alternativesContainer.innerHTML = "";
        alternativesSection.classList.add('hidden');
        updateScoreUI(0);
        
        fetchProductData(barcode);
    }
});

scanAgainBtn.addEventListener('click', showScannerView);


// --- SCORING LOGIC ---

function calculateProcessedScore(product) {
    // Check if critical data is missing
    if (!product.nova_group && !product.ingredients_text) {
        return null; // Unknown
    }

    let score = 0;
    const novaGroup = product.nova_group;
    
    // Base Score
    if (novaGroup === 1) score = 0;
    else if (novaGroup === 2) score = 20;
    else if (novaGroup === 3) score = 40;
    else if (novaGroup === 4) score = 60;
    else score = 10; // Default if NOVA missing but ingredients exist

    // Ingredient Analysis
    // We check multiple fields to find the ingredients
    const text = product.ingredients_text_with_allergens || product.ingredients_text_en || product.ingredients_text || "";
    const ingredients = text.toLowerCase();
    
    if (ingredients.includes('corn syrup')) score += 10;
    if (ingredients.includes('artificial flavor')) score += 5;
    if (ingredients.includes('artificial color')) score += 5;
    if (ingredients.includes('red 40') || ingredients.includes('yellow 5') || ingredients.includes('blue 1')) score += 5;
    if (ingredients.includes('hydrogenated')) score += 10;
    if (ingredients.includes('nitrite') || ingredients.includes('nitrate')) score += 7;

    // Nutritional Analysis
    const nutriments = product.nutriments || {};
    if ((nutriments.sugars_100g || 0) > 15) score += 5;
    if ((nutriments.sodium_100g || 0) > 0.6) score += 5;

    if (score > 100) score = 100;
    return score;
}

function updateScoreUI(score) {
    scoreDisplayEl.classList.remove('score-low', 'score-medium', 'score-high');
    
    if (score === null) {
        scoreDisplayEl.textContent = "?";
        return; // Stays grey
    }

    if (score < 40) scoreDisplayEl.classList.add('score-low');
    else if (score < 70) scoreDisplayEl.classList.add('score-medium');
    else scoreDisplayEl.classList.add('score-high');
    
    scoreDisplayEl.textContent = `${score}%`;
}

// --- ALTERNATIVES SEARCH ---

function fetchSimilarProducts(categoryTag) {
    // Search for healthier items (NOVA 1, 2, 3) in same category
    const searchUrl = `https://world.openfoodfacts.org/api/v2/search?categories_tags_en=${categoryTag}&nova_groups=1,2,3&sort_by=unique_scans_n&page_size=3&fields=product_name,image_front_small_url,nova_group,nutrition_grades_tags`;

    fetch(searchUrl)
        .then(response => response.json())
        .then(data => {
            if (data.products && data.products.length > 0) {
                alternativesContainer.innerHTML = "";
                
                // Add header back if we cleared it
                const header = document.createElement('h3');
                header.textContent = "Healthier Alternatives";
                alternativesContainer.appendChild(header);

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
        .catch(console.error);
}


// --- MAIN DATA FETCH ---

function fetchProductData(barcode) {
    const apiUrl = `https://world.openfoodfacts.org/api/v2/product/${barcode}`;
    
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data.status === 1 && data.product) {
                const product = data.product;
                
                // 1. Calculate Score
                const processedScore = calculateProcessedScore(product);

                // 2. Update UI Text
                productNameEl.textContent = product.product_name || 'Name not found';
                
                // Try harder to find ingredients text
                const ingText = product.ingredients_text_with_allergens || product.ingredients_text_en || product.ingredients_text;
                
                if (ingText) {
                    ingredientsTextEl.textContent = ingText;
                } else {
                    ingredientsTextEl.textContent = "⚠️ Ingredient list missing from database.";
                    ingredientsTextEl.style.color = "#e74c3c";
                }

                // 3. Update Score Bubble
                updateScoreUI(processedScore);

                // 4. DECISION LOGIC: Great Choice OR Alternatives?
                
                if (processedScore !== null && processedScore < 40) {
                    // CASE A: It's Green (< 40%). Show "Great Choice".
                    alternativesSection.classList.remove('hidden');
                    alternativesContainer.innerHTML = `
                        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; border: 1px solid #4CAF50;">
                            <h3 style="color: #4CAF50; margin: 0; font-size: 1.2em;">Great Choice!</h3>
                            <p style="margin: 5px 0 0 0; color: #2e7d32;">This product has a low processing score.</p>
                        </div>
                    `;
                } 
                else if (product.categories_tags && product.categories_tags.length > 0) {
                    // CASE B: It's Yellow or Red. Search for alternatives.
                    const category = product.categories_tags[product.categories_tags.length - 1];
                    fetchSimilarProducts(category);
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
            ingredientsTextEl.textContent = "Please check internet connection.";
        });
}

// Start the app
showScannerView();