
// 1. ADATBÁZISOK (Függvényeken KÍVÜL!)

let serviceDB = [];

let deviceDB = [];
        // ==========================================
        // 1. STATE & VEZÉRLÉS
        // ==========================================
        let configState = {
            mode: null,
            quantity: 1,
            environment: 'indoor',
            costVsPro: 3, 
            deviceType: 'aed',
            proEnvironment: 'general',
            needDisplay: false,
            opMode: 'semi',
            childUse: false,
			displaySize: 2,
			batteryLife: 2,
			memoryCapacity: 2,
			defibMode: 'async',
			tempMeasurement: false,
			dataTransfer: 'none',
            monitorSpecs: {
                pacing: false, spo2: false, etco2: false, nibp: false, '12lead': false, printer: false
            },
            accessories: {
                wallMount: false, outdoorCabinet: false, childPad: false, extraPad: false, cprKit: false, training: false, maintenance: false
            },
            selectedDevice: null // Ide mentjük, hogy melyiket választotta a listából
        };

        const accessoryNames = { 
            wallMount: 'Beltéri Fali Konzol', 
            outdoorCabinet: 'Kültéri Fűthető Kabin (Riasztóval)', 
            childPad: 'Gyermek Elektróda', 
            extraPad: 'Tartalék Felnőtt Elektróda',
            cprKit: 'CPR Életmentő Készlet', 
            training: 'Helyszíni Oktatás', 
            maintenance: 'Éves Karbantartás' 
        };

        let routeSteps = []; 
        let currentRouteIndex = 0;

        function setMode(mode) {
            configState.mode = mode;
            const allModules = document.querySelectorAll('.step-module');
            routeSteps = [];
            
            allModules.forEach(el => {
                const stepNum = parseInt(el.getAttribute('data-step'));
                if (stepNum <= 3) {
                    routeSteps.push(el); // 1, 2, 3 közös kezdő
                } else if (stepNum >= 7) {
                    routeSteps.push(el); // 7, 8, 9, 10, 11 közös záró
                } else {
                    if (el.classList.contains(`route-${mode}`)) {
                        routeSteps.push(el); // route-simple: 4, 5. route-expert: 4, 5, 6.
                    }
                }
            });

            document.getElementById('btnNext').classList.remove('hidden');
        }

        function updateConfig(key, value) { configState[key] = value; }
        function updateMonitorSpec(key, checked) { configState.monitorSpecs[key] = checked; }
        function updateAccessory(key, isChecked) { configState.accessories[key] = isChecked; }

        // Szinkronizált mennyiség léptetés (Gombokhoz és csúszkához)
        function syncQtyDisplays(val) {
            let v = parseInt(val);
            if(isNaN(v) || v < 1) v = 1;
            if(v > 100) v = 100;
            configState.quantity = v;
            
            const simpleSlider = document.getElementById('qtySliderSimple');
            const simpleDisplay = document.getElementById('qtyDisplaySimple');
            const expertSlider = document.getElementById('qtySliderExpert');
            const expertDisplay = document.getElementById('qtyDisplayExpert');
            
            if(simpleSlider) simpleSlider.value = v;
            if(simpleDisplay) simpleDisplay.innerText = v;
            if(expertSlider) expertSlider.value = v;
            if(expertDisplay) expertDisplay.innerText = v;
        }

        function adjustQty(amount) {
            syncQtyDisplays(configState.quantity + amount);
        }

        function toggleMonitorQuestions() {
            const block = document.getElementById('monitorQuestionsBlock');
            const aedBlock = document.getElementById('aedQuestionsBlock');
            if (configState.deviceType === 'monitor') {
                block.classList.remove('hidden');
                aedBlock.classList.add('hidden');
            } else {
                block.classList.add('hidden');
                aedBlock.classList.remove('hidden');
            }
        }

        // ==========================================
        // 2. LÉPTETÉS MOTOR ÉS OLDALSÓ ÖSSZEGZÉS
        // ==========================================
        function changeStep(direction) {
            if (!configState.mode && currentRouteIndex === 2 && direction > 0) {
                alert("Kérjük, válasszon felhasználási profilt a folytatáshoz!"); return;
            }

            const newIndex = currentRouteIndex + direction;
            
            if (newIndex >= 0 && newIndex < routeSteps.length) {
                const container = document.getElementById('moduleContainer');
                const overlay = document.getElementById('heartbeatOverlay');
                const ekgPath = overlay.querySelector('.ekg-path');
                const heartbeatAudio = document.getElementById('heartbeatSound');

                if (heartbeatAudio) {
                    heartbeatAudio.volume = 1.0;
                    heartbeatAudio.currentTime = 0;
                    heartbeatAudio.play().catch(e => console.log("Hanglejátszás blokkolva."));
                }

                container.classList.add('blur-sm', 'opacity-50', 'pointer-events-none');
                overlay.classList.remove('hidden');
                overlay.classList.add('flex');
                
                ekgPath.classList.remove('animate-ekg');
                void ekgPath.offsetWidth;
                ekgPath.classList.add('animate-ekg');

                setTimeout(() => {
                    routeSteps[currentRouteIndex].classList.remove('active');
                    currentRouteIndex = newIndex;
                    
                    const nextStepNum = parseInt(routeSteps[currentRouteIndex].getAttribute('data-step'));
                    
                    // --- KÖRNYEZETI LOGIKA A KIEGÉSZÍTŐK ELŐTT (9. Lépés) ---
                    // Csak akkor mutatjuk a kültéri kabint, ha a korábbiakban kültéri elhelyezést választott
                    if (nextStepNum === 9) {
                        const outdoorWrapper = document.getElementById('outdoorCabinetWrapper');
                        if (outdoorWrapper) {
                            const isOutdoor = (configState.mode === 'simple' && configState.environment === 'outdoor') || 
                                              (configState.mode === 'expert' && (configState.proEnvironment === 'public' || configState.proEnvironment === 'emergency'));
                            
                            if (isOutdoor) {
                                outdoorWrapper.style.display = 'block';
                            } else {
                                outdoorWrapper.style.display = 'none';
                                document.getElementById('chk_outdoorCabinet').checked = false;
                                configState.accessories.outdoorCabinet = false;
                            }
                        }

                        // Gyermek elektróda szinkronizálása a profi ág korábbi kérdéséből
                        if (configState.mode === 'expert' && configState.childUse) {
                            document.getElementById('chk_childPad').checked = true;
                            configState.accessories.childPad = true;
                        }
                    }

                    // --- AJÁNLÓMOTOR FUTTATÁSA 10. lépés---
                    if (nextStepNum === 10) {
                        runScoringEngine();
                    }

                    // --- ÖSSZEGZÉS PANEL FELÉPÍTÉSE (11. Lépés) ---
                    if (nextStepNum === 11) {
                        buildFinalSummary();
                    }

                    routeSteps[currentRouteIndex].classList.add('active');
                    updateUI();
                    
                    container.classList.remove('blur-sm', 'opacity-50', 'pointer-events-none');
                    setTimeout(() => { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }, 150);

                }, 750); 
            }
        }

        function updateUI() {
            const progress = (currentRouteIndex / (routeSteps.length - 1)) * 100;
            document.getElementById('progressBar').style.width = `${progress}%`;
            
            const btnPrev = document.getElementById('btnPrev');
            const btnNext = document.getElementById('btnNext');

            if (currentRouteIndex === 0) btnPrev.classList.add('invisible');
            else btnPrev.classList.remove('invisible');

            if (currentRouteIndex === 2 && !configState.mode) {
                btnNext.classList.add('hidden'); 
            } else if (currentRouteIndex === routeSteps.length - 1) {
                btnNext.classList.add('hidden'); 
            } else {
                btnNext.classList.remove('hidden');
            }
        }

        function buildFinalSummary() {
            // Darabszám és kiválasztott eszköz
            document.getElementById('summaryQty').innerText = `${configState.quantity} db`;
            document.getElementById('summaryDeviceName').innerText = configState.selectedDevice || 'Készülék kiválasztása folyamatban...';
            
            // Elhelyezés szövegének meghatározása
            const envDiv = document.getElementById('summaryEnv');
            if (configState.mode === 'simple') {
                if (configState.environment === 'indoor') {
                    envDiv.innerHTML = '<i class="fa-solid fa-building mr-2 text-gray-400"></i>Kizárólag beltéri elhelyezés';
                } else {
                    envDiv.innerHTML = '<i class="fa-solid fa-tree-city mr-2 text-brand-lightblue"></i>Kültéri elhelyezést is igényel';
                }
            } else {
                const envMap = { 'general': 'Általános betegellátás', 'emergency': 'Sürgősségi/Mentő', 'icu': 'Intenzív osztály', 'public': 'Közterület' };
                envDiv.innerHTML = `<i class="fa-solid fa-hospital mr-2 text-brand-lightblue"></i>${envMap[configState.proEnvironment]}`;
            }

            // Kiegészítők listázása a panelen
            const listUl = document.getElementById('summaryAccessories');
            listUl.innerHTML = '';
            
            let hasAccessory = false;
            for (const [key, isChecked] of Object.entries(configState.accessories)) {
                if (isChecked) {
                    hasAccessory = true;
                    const li = document.createElement('li');
                    li.className = 'flex items-start';
                    li.innerHTML = `<i class="fa-solid fa-check text-green-500 mt-1 mr-2"></i> <span>${accessoryNames[key]}</span>`;
                    listUl.appendChild(li);
                }
            }
            
            if (!hasAccessory) {
                listUl.innerHTML = '<li class="text-gray-400 italic">Nem választott kiegészítő opciót.</li>';
            }
        }

        // ==========================================
        // 3. INTELLIGENS PONTOZÓ MOTOR
        // ==========================================
        let engineResults = []; 

        function runScoringEngine() {
            engineResults = []; 
            
            deviceDB.forEach(device => {
                let score = 100; 
                
                if (configState.mode === 'expert') {
                    if (configState.deviceType === 'monitor' && device.type === 'aed') score = 0;
                    if (configState.deviceType === 'aed' && device.type === 'monitor') score = 0;
                    
                    if (configState.deviceType === 'aed' && configState.needDisplay === true && device.display === false) {
                        score -= 40; 
                    }
                }

                if (configState.mode === 'simple') {
                    const costPref = parseInt(configState.costVsPro);
                    const diff = Math.abs(costPref - device.costLevel);
                    score -= (diff * 15); 
                }

                if (score > 0) score -= Math.floor(Math.random() * 4); 
                if (score < 10) score = 10; 

                engineResults.push({ ...device, match: score });
            });

            engineResults.sort((a, b) => b.match - a.match);

            const resultsDiv = document.getElementById('recommendationResults');
            resultsDiv.innerHTML = '';
            
            const top3 = engineResults.slice(0, 3);
            
            // Ha van javasolt, alapból kiválasztjuk a legelsőt
            if (top3.length > 0) {
                configState.selectedDevice = top3[0].name;
            }

            top3.forEach((res, idx) => {
                let isChecked = idx === 0 ? 'checked' : '';
                let medal = idx === 0 ? '<div class="absolute -top-3 -left-3 w-8 h-8 bg-brand-yellow text-white rounded-full flex items-center justify-center shadow text-sm z-10"><i class="fa-solid fa-star"></i></div>' : '';
                
                // Rádiógombos szerkezet
				resultsDiv.innerHTML += `
					<label class="radio-card cursor-pointer block w-full relative group">
					<!-- Ez az eredeti rádiógomb a kiválasztáshoz -->
					<input type="radio" name="selectedRecommendation" value="${res.name}" ${isChecked} onchange="updateConfig('selectedDevice', '${res.name}')">
        
					<div class="border-2 border-gray-200 bg-white p-4 rounded-xl flex items-center shadow-sm relative transition-all hover:border-brand-lightblue h-full">
					<div class="check-icon absolute top-3 right-3 text-brand-blue opacity-0 transition-all scale-50"><i class="fa-solid fa-circle-check text-xl"></i></div>
				${medal}
            
					<div class="w-16 h-16 md:w-20 md:h-20 flex-shrink-0 bg-white border border-gray-100 rounded-lg overflow-hidden flex items-center justify-center mr-4 p-1">
					<img src="${res.image}" alt="${res.name}" onclick="openProductModal('${res.name}', 'product')" class="max-w-full max-h-full object-contain cursor-pointer hover:opacity-80 transition-opacity">
					</div>

					<div class="text-xl md:text-2xl font-bold ${idx === 0 ? 'text-brand-blue' : 'text-gray-400'} w-14 md:w-20 text-center border-r border-gray-200 mr-4 flex-shrink-0">
                ${res.match}%
					</div>
            
            <div class="flex-grow pr-6">
                <h4 class="font-bold text-lg md:text-xl text-gray-900 leading-tight mb-1">${res.name}</h4>
                <p class="text-xs md:text-sm text-gray-600 line-clamp-2 md:line-clamp-none">${res.description}</p>
                
               <!-- ÚJ: Összehasonlítás Checkbox (Javított kattintás) -->
<div class="mt-3 inline-flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full cursor-pointer hover:bg-gray-100 transition-colors z-20" onclick="event.stopPropagation();">
    <input type="checkbox" id="comp_${res.name}" class="w-4 h-4 text-brand-yellow focus:ring-brand-yellow rounded cursor-pointer" onclick="event.stopPropagation();" onchange="toggleCompare('${res.name}', this.checked)">
    <span class="text-xs font-bold text-gray-600" onclick="document.getElementById('comp_${res.name}').click();"><i class="fa-solid fa-code-compare mr-1"></i> VS Összehasonlít</span>
</div>
            </div>
        </div>
    </label>
                `;
            });
        }

// ==========================================
// 4. MINICRM BEKÜLDÉS ÉS ADATGYŰJTÉS
// ==========================================
async function submitForm(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Adatok feldolgozása...';
    btn.disabled = true;

    let crmText = `--- ÚJ AJÁNLATKÉRÉS ---\n`;
    crmText += `Ügyfél profil: ${configState.mode === 'expert' ? 'Klinikai/Profi' : 'Vállalati/Laikus'}\n`;
    crmText += `Igényelt darabszám: ${configState.quantity} db\n`;
    
    if (configState.mode === 'simple') {
        crmText += `Környezet: ${configState.environment === 'indoor' ? 'Kizárólag beltér' : 'Kültér is érintett'}\n`;
    } else {
        const envMap = { 'general': 'Általános betegellátás', 'emergency': 'Sürgősségi/Mentő', 'icu': 'Intenzív osztály', 'public': 'Közterület' };
        crmText += `Környezet: ${envMap[configState.proEnvironment]}\n`;
        
        // --- ÚJ: TECHNIKAI SPECIFIKÁCIÓ SZÖVEGESÍTÉSE (PROFI ÁG) ---
        crmText += `\n--- TECHNIKAI SPECIFIKÁCIÓ (PROFI ÁG) ---\n`;
        
        const displayMap = { "1": "5\" (Kompakt)", "2": "7\" (Sztenderd)", "3": "10\"+ (Nagy)" };
        const batteryMap = { "1": "2 óra", "2": "4 óra", "3": "6+ óra" };
        const memoryMap = { "1": "50 esemény", "2": "200 esemény", "3": "Korlátlan/Felhő" };
        const dataTransferMap = { "none": "Nincs", "wifi": "Wi-Fi", "lte": "4G / LTE" };
        
        crmText += `Kijelző mérete: ${displayMap[configState.displaySize]}\n`;
        crmText += `Akkumulátor: ${batteryMap[configState.batteryLife]}\n`;
        crmText += `Esemény naplózás: ${memoryMap[configState.memoryCapacity]}\n`;
        crmText += `Defibrillációs mód: ${configState.defibMode === 'sync' ? 'Szinkronizált Kardioverzió' : 'Manuális Aszinkron'}\n`;
        crmText += `Hőmérséklet mérés: ${configState.tempMeasurement ? 'Szükséges' : 'Nem kell'}\n`;
        crmText += `Adatátvitel: ${dataTransferMap[configState.dataTransfer]}\n`;
    }
    crmText += `\n`;
    
    crmText += `--- KIVÁLASZTOTT KÉSZÜLÉK ---\n`;
    if (configState.selectedDevice) {
        let selectedRes = engineResults.find(d => d.name === configState.selectedDevice);
        let matchText = selectedRes ? `(${selectedRes.match}% egyezés)` : '';
        crmText += `Név: ${configState.selectedDevice} ${matchText}\n\n`;
    } else {
        crmText += `Név: Nem választott\n\n`;
    }

    crmText += `--- KIEGÉSZÍTŐK ÉS SZOLGÁLTATÁSOK ---\n`;
    let hasAccessory = false;
    for (const [key, isChecked] of Object.entries(configState.accessories)) {
        if (isChecked) {
            crmText += `- ${accessoryNames[key]}\n`;
            hasAccessory = true;
        }
    }
    if (!hasAccessory) crmText += `- Nincs kiegészítő kiválasztva.\n`;
    crmText += `\n`;

    const userNote = document.getElementById('userNoteInput').value;
    crmText += `--- ÜGYFÉL MEGJEGYZÉSE ---\n${userNote ? userNote : 'Nem hagyott megjegyzést.'}`;
    
    document.getElementById('hiddenCompiledConfig').value = crmText;

try {
        // 1. IDE MÁSOLD BE A MINICRM ÁLTAL ADOTT LINKET
        const miniCrmUrl = "81711-2d0r9b69n90qm5rdg0c0275y1en9d5@in.minicrm.hu"; 

        // 2. Összeállítjuk az adatcsomagot, amit a szerver vár
        const formData = new FormData();
        
        // Fontos: Itt a "Megjegyzes" nevű részt lehet, hogy át kell írnod arra a 
        // mezőnévre, amit a MiniCRM-ben ehhez az űrlaphoz beállítottatok!
        formData.append("Megjegyzes", crmText); 
        
        // (Opcionális: Ha az emailt és nevet külön is be akarod küldeni)
        // formData.append("Email", document.getElementById('email').value);
        // formData.append("Nev", document.getElementById('name').value);

        // 3. Elküldjük az adatokat a MiniCRM-nek a háttérben
        await fetch(miniCrmUrl, {
            method: "POST",
            body: formData,
            mode: "no-cors" // Ez gyakran szükséges külső CRM-eknél a böngésző tiltásának elkerülésére
        });

        // 4. Ha a küldés lefutott, frissítjük a felületet
        document.getElementById('leadForm').classList.add('hidden');
        document.getElementById('successMessage').classList.remove('hidden');
        document.getElementById('successMessage').classList.add('flex');
        document.getElementById('footerControls').classList.add('hidden');
        
        console.log("Adatok sikeresen továbbítva a MiniCRM felé!");

    } catch (error) {
        console.error(error);
        alert("Hiba történt az adatküldés során. Kérjük próbálja újra!");
        btn.innerHTML = 'Ajánlatkérés elküldése';
        btn.disabled = false;
    }
}

// ==========================================
// ADATBÁZIS BETÖLTÉSE ÉS RENDSZER INICIALIZÁLÁSA
// ==========================================
async function initApp() {
    try {
        // 1. JSON fájl beolvasása
        const response = await fetch('adatbazis.json');
        const data = await response.json();
        
        // 2. Adatok betöltése a változókba
        deviceDB = data.devices;
        serviceDB = data.services;
        
        // 3. Program elindítása (Első modul aktívvá tétele)
        document.querySelector(`.step-module[data-step="1"]`).classList.add('active');
        document.getElementById('btnNext').classList.remove('hidden'); 
        document.querySelectorAll('.step-module').forEach(el => {
            if(parseInt(el.getAttribute('data-step')) <= 3) routeSteps.push(el);
        });
        
    } catch (error) {
        console.error("Hiba történt az adatbázis betöltésekor:", error);
        alert("Rendszerhiba: Nem sikerült betölteni a termékadatokat. Kérjük, frissítse az oldalt!");
    }
}

// Indítás
initApp();


// 2. A MÓDOSÍTOTT FÜGGVÉNY (Ezt hagyd így, ahogy megírtad, csak a serviceDB-t vedd ki belőle)
function openProductModal(itemName, type = 'product') {
    let item;
    
    if (type === 'product') {
        item = deviceDB.find(d => d.name === itemName);
    } else if (type === 'service') {
        item = serviceDB.find(s => s.name === itemName);
    }

    if (!item) return;

    const content = document.getElementById('modalContent');
    content.innerHTML = `
        <h2 class="text-3xl font-bold mb-4 text-brand-blue">${item.name}</h2>
        <img src="${item.image}" class="w-full h-64 object-contain mb-6 rounded-lg">
        <p class="text-gray-700 leading-relaxed mb-8">${item.description}</p>
        <button onclick="closeProductModal()" class="w-full bg-brand-blue hover:bg-blue-800 text-white py-3 rounded-lg font-bold transition-all">Bezárás</button>
    `;
    
    document.getElementById('productModal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

// --- ÖSSZEHASONLÍTÓ (VS) LOGIKA ---
let compareList = [];

function toggleCompare(deviceName, isChecked) {
    if (isChecked) {
        if (compareList.length >= 2) {
            alert("Maximum 2 készüléket választhat az összehasonlításhoz!");
            document.getElementById(`comp_${deviceName}`).checked = false;
            return;
        }
        compareList.push(deviceName);
    } else {
        compareList = compareList.filter(n => n !== deviceName);
    }
    
    // Mutatjuk vagy rejtjük a lebegő gombot
    const btn = document.getElementById('floatingCompareBtn');
    if (compareList.length === 2) {
        btn.classList.remove('hidden');
        btn.classList.add('flex');
    } else {
        btn.classList.add('hidden');
        btn.classList.remove('flex');
    }
}

function openCompareModal() {
    if (compareList.length !== 2) return;
    
    const dev1 = deviceDB.find(d => d.name === compareList[0]);
    const dev2 = deviceDB.find(d => d.name === compareList[1]);

    const container = document.getElementById('compareTableContainer');
    container.innerHTML = `
        <table class="w-full text-left border-collapse min-w-[600px]">
            <thead>
                <tr class="bg-gray-50 border-b-2 border-brand-blue">
                    <th class="p-4 font-bold text-gray-700 w-1/3 rounded-tl-lg">Tulajdonság</th>
                    <th class="p-4 font-bold text-brand-blue w-1/3 text-center text-xl">${dev1.name}</th>
                    <th class="p-4 font-bold text-brand-blue w-1/3 text-center text-xl rounded-tr-lg">${dev2.name}</th>
                </tr>
            </thead>
            <tbody>
                <tr class="border-b border-gray-200">
                    <td class="p-4 font-semibold text-gray-600"><i class="fa-solid fa-image mr-2"></i> Kép</td>
                    <td class="p-4"><img src="${dev1.image}" class="h-24 mx-auto object-contain"></td>
                    <td class="p-4"><img src="${dev2.image}" class="h-24 mx-auto object-contain"></td>
                </tr>
                <tr class="border-b border-gray-200 bg-gray-50">
                    <td class="p-4 font-semibold text-gray-600"><i class="fa-solid fa-weight-hanging mr-2"></i> Súly</td>
                    <td class="p-4 text-center font-bold">${dev1.specs.weight}</td>
                    <td class="p-4 text-center font-bold">${dev2.specs.weight}</td>
                </tr>
                <tr class="border-b border-gray-200">
                    <td class="p-4 font-semibold text-gray-600"><i class="fa-solid fa-droplet-slash mr-2"></i> IP Védettség</td>
                    <td class="p-4 text-center text-sm">${dev1.specs.ip}</td>
                    <td class="p-4 text-center text-sm">${dev2.specs.ip}</td>
                </tr>
                <tr class="border-b border-gray-200 bg-gray-50">
                    <td class="p-4 font-semibold text-gray-600"><i class="fa-solid fa-battery-full mr-2"></i> Akkumulátor</td>
                    <td class="p-4 text-center text-sm">${dev1.specs.battery}</td>
                    <td class="p-4 text-center text-sm">${dev2.specs.battery}</td>
                </tr>
                <tr class="border-b border-gray-200">
                    <td class="p-4 font-semibold text-gray-600"><i class="fa-solid fa-tv mr-2"></i> Kijelző</td>
                    <td class="p-4 text-center text-sm">${dev1.specs.display}</td>
                    <td class="p-4 text-center text-sm">${dev2.specs.display}</td>
                </tr>
                <tr class="border-b border-gray-200 bg-gray-50">
                    <td class="p-4 font-semibold text-gray-600"><i class="fa-solid fa-heart-pulse mr-2"></i> Pacemaker</td>
                    <td class="p-4 text-center text-sm">${dev1.specs.pacing}</td>
                    <td class="p-4 text-center text-sm">${dev2.specs.pacing}</td>
                </tr>
            </tbody>
        </table>
    `;
    
    document.getElementById('compareModal').classList.remove('hidden');
    document.getElementById('compareModal').classList.add('flex');
}

function closeCompareModal() {
    document.getElementById('compareModal').classList.add('hidden');
    document.getElementById('compareModal').classList.remove('flex');
    
    // Opcionális: Ürítjük a listát bezáráskor, hogy újrakezdhesse
    compareList = [];
    document.querySelectorAll('input[id^="comp_"]').forEach(cb => cb.checked = false);
    document.getElementById('floatingCompareBtn').classList.add('hidden');
    document.getElementById('floatingCompareBtn').classList.remove('flex');
}