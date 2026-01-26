/* =========================================
   NUTRISNAP MAIN LOGIC
   ========================================= */

// --- KONFIGURASI API ---
const LOGMEAL_TOKEN = "36e194aa6e229b5dd49edbf2a7add2f00a792a21";
const KALORI_API_KEY = "kal_97f41a3a19ba02ffd1eac01bc2338265fd3a1db8c51df3e4e1c96c35f89d78af";

// Elemen UI
const screens = Array.from(document.querySelectorAll('.screen'));
const mainNav = document.querySelector('.bottombar');
const userIcon = document.getElementById('userIcon');
const fabBtn = document.getElementById('fabBtn');

// --- FUNGSI NAVIGASI ---
function showScreen(id) {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const isAuthScreen = ['login', 'emailLogin', 'emailSignup', 'onboarding'].includes(id);

    // Hide Nav on Auth Screens
    if (isAuthScreen || !isLoggedIn) {
        if(mainNav) mainNav.classList.add('hidden');
        if(userIcon) userIcon.classList.add('hidden');
        if(fabBtn) fabBtn.classList.add('hidden');
        if (id === 'home' && !isLoggedIn) id = 'login';
    } else {
        if(mainNav) mainNav.classList.remove('hidden');
        if(userIcon) userIcon.classList.remove('hidden');
        if(fabBtn) fabBtn.classList.remove('hidden');
    }

    screens.forEach(s => {
        if (s.id === id) s.classList.add('active');
        else s.classList.remove('active');
    });
    
    // Update active state on bottom bar buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.nav === id);
    });

    // Render data specific pages
    if(id === 'home') renderHomeStats();
    if(id === 'analysis') renderMeals(); // Assuming 'analysis' is the diary page
}

// Event Listeners for Navigation
document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
        e.preventDefault();
        showScreen(el.dataset.nav);
    });
});


// --- FUNGSI KAMERA & AI ---

// 1. Listen for File Input Changes
const cameraInput = document.getElementById('cameraInput');
const galleryInput = document.getElementById('galleryInput');

if(cameraInput) cameraInput.addEventListener('change', handleImageSelect);
if(galleryInput) galleryInput.addEventListener('change', handleImageSelect);

function handleImageSelect(e) {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = function(event) {
            // Show Preview
            const preview = document.getElementById('uploadPreview');
            const placeholder = document.getElementById('uploadPlaceholder');
            const loading = document.getElementById('aiLoading');

            if(preview) {
                preview.src = event.target.result;
                preview.classList.remove('hidden');
            }
            if(placeholder) placeholder.classList.add('hidden');
            if(loading) loading.classList.remove('hidden'); // Show spinner

            // Start AI Process
            processFoodImage(file);
        }
        reader.readAsDataURL(file);
    }
}

// 2. Process Image with LogMeal API
async function processFoodImage(imageFile) {
    const loadingText = document.querySelector('#aiLoading p');
    if(loadingText) loadingText.innerText = "Menganalisis Gambar...";

    let formData = new FormData();
    formData.append('image', imageFile, 'food.jpg');

    try {
        // LogMeal API via CORS Proxy
        const proxy = "https://corsproxy.io/?";
        const targetUrl = "https://api.logmeal.com/v2/image/segmentation/complete";
        
        const response = await fetch(proxy + encodeURIComponent(targetUrl), {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${LOGMEAL_TOKEN}` 
            },
            body: formData
        });

        if (!response.ok) throw new Error("LogMeal API Error: " + response.status);

        const data = await response.json();
        
        // Extract Food Name
        let detectedName = null;
        if (data.food_family && data.food_family.length > 0) {
            detectedName = data.food_family[0].name;
        } else if (data.recognition_results && data.recognition_results.length > 0) {
            detectedName = data.recognition_results[0].name;
        }

        if (!detectedName) throw new Error("Makanan tidak dikenali.");

        // 3. Search Nutrition in Kalori.my
        if(loadingText) loadingText.innerText = `Dikesan: ${detectedName}...`;
        await searchNutrition(detectedName);

    } catch (error) {
        console.error(error);
        handleAiError();
    }
}

// 3. Search Nutrition Data
async function searchNutrition(foodName) {
    const loadingText = document.querySelector('#aiLoading p');
    if(loadingText) loadingText.innerText = "Mencari Data Nutrisi...";

    try {
        const url = `https://api.kalori.my/v1/foods/search?q=${encodeURIComponent(foodName)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${KALORI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const json = await response.json();
        
        // Hide Loading
        const loading = document.getElementById('aiLoading');
        if(loading) loading.classList.add('hidden');

        // Check Results
        // Kalori.my usually returns { data: [...] } or array directly
        const foodList = json.data || json;
        
        if (foodList && foodList.length > 0) {
            const food = foodList[0];
            
            // Confirm with User
            const msg = `AI Menjumpai:\n${food.name}\n\nKalori: ${food.calories} kcal\nProtein: ${food.protein}g\nKarbo: ${food.carbohydrates}g\n\nSimpan ke Diari?`;
            
            if (confirm(msg)) {
                saveMeal({
                    name: food.name,
                    calories: parseFloat(food.calories),
                    protein: parseFloat(food.protein),
                    carbs: parseFloat(food.carbohydrates),
                    date: new Date().toISOString().split('T')[0],
                    image: document.getElementById('uploadPreview').src
                });
            } else {
                resetUpload();
            }
        } else {
            // Not found in database
            if(confirm(`Data nutrisi untuk '${foodName}' tidak dijumpai.\nSimpan gambar sahaja?`)) {
                saveMeal({
                    name: foodName,
                    calories: 0, protein: 0, carbs: 0,
                    date: new Date().toISOString().split('T')[0],
                    image: document.getElementById('uploadPreview').src
                });
            } else {
                resetUpload();
            }
        }

    } catch (error) {
        console.error("Kalori Error:", error);
        alert("Ralat mendapatkan data nutrisi.");
        resetUpload();
    }
}

function handleAiError() {
    // Fallback if AI fails completely
    const loading = document.getElementById('aiLoading');
    if(loading) loading.classList.add('hidden');
    
    const manualName = prompt("AI Gagal. Sila masukkan nama makanan secara manual:");
    if (manualName) {
        searchNutrition(manualName);
    } else {
        resetUpload();
    }
}

// --- FUNGSI DATA ---

function saveMeal(meal) {
    const meals = JSON.parse(localStorage.getItem('mealLogs') || '[]');
    meals.push(meal);
    localStorage.setItem('mealLogs', JSON.stringify(meals));
    alert("Makanan disimpan!");
    resetUpload();
    showScreen('home');
}

function resetUpload() {
    const preview = document.getElementById('uploadPreview');
    const placeholder = document.getElementById('uploadPlaceholder');
    const loading = document.getElementById('aiLoading');
    
    if(preview) { preview.src = ""; preview.classList.add('hidden'); }
    if(placeholder) placeholder.classList.remove('hidden');
    if(loading) loading.classList.add('hidden');
    
    if(cameraInput) cameraInput.value = "";
    if(galleryInput) galleryInput.value = "";
}

function renderHomeStats() {
    const meals = JSON.parse(localStorage.getItem('mealLogs') || '[]');
    const today = new Date().toISOString().split('T')[0];
    const todayMeals = meals.filter(m => m.date === today);

    let cal = 0, prot = 0, carb = 0;
    let listHtml = "";

    todayMeals.forEach(m => {
        cal += (m.calories || 0);
        prot += (m.protein || 0);
        carb += (m.carbs || 0);
        listHtml += `<div class="list-item"><div class="item-val">${m.name}</div><div class="item-date">${m.calories} kcal</div></div>`;
    });

    document.getElementById('calBalance').innerText = cal.toFixed(0);
    document.getElementById('protBalance').innerText = prot.toFixed(0);
    document.getElementById('carbBalance').innerText = carb.toFixed(0);
    
    const listEl = document.getElementById('recentMealsList');
    if(listEl) listEl.innerHTML = listHtml || '<div style="text-align:center; color:#999; padding:10px;">Tiada rekod hari ini</div>';
}

function renderMeals() {
    // Diary render logic here (if needed for 'analysis' page)
    const container = document.getElementById('mealsContainer');
    if(!container) return;
    
    const meals = JSON.parse(localStorage.getItem('mealLogs') || '[]');
    container.innerHTML = "";
    
    if(meals.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#999;'>Tiada sejarah makanan.</p>";
        return;
    }

    // Group by date, etc. (Simplified for now)
    meals.slice().reverse().forEach(m => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div style="display:flex; align-items:center;">
                ${m.image ? `<img src="${m.image}" style="width:40px; height:40px; border-radius:5px; margin-right:10px; object-fit:cover;">` : ''}
                <div>
                    <div style="font-weight:bold;">${m.name}</div>
                    <div style="font-size:12px; color:#888;">${m.date}</div>
                </div>
            </div>
            <div style="font-weight:bold;">${m.calories} kcal</div>
        `;
        container.appendChild(div);
    });
}

// --- INITIALIZATION ---
// Check login status on load
if (localStorage.getItem('isLoggedIn') === 'true') {
    showScreen('home');
} else {
    showScreen('login');
}