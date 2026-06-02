        // LocalStorage 차단 시(예: 브라우저 로컬 file:// 실행) 에러 방지용 Fallback 구현
        (function() {
            try {
                localStorage.setItem('__test_storage__', 'ok');
                localStorage.removeItem('__test_storage__');
            } catch (e) {
                console.warn("LocalStorage가 제한되었습니다. 메모리 스토리지를 사용합니다.");
                const memStore = {};
                const mockStorage = {
                    getItem(key) { return key in memStore ? memStore[key] : null; },
                    setItem(key, val) { memStore[key] = String(val); },
                    removeItem(key) { delete memStore[key]; },
                    clear() { for (let k in memStore) delete memStore[k]; },
                    key(i) { return Object.keys(memStore)[i] || null; },
                    get length() { return Object.keys(memStore).length; }
                };
                Object.defineProperty(window, 'localStorage', {
                    value: mockStorage,
                    writable: true
                });
            }
        })();

        // =========================================================================
        // ★ [FIREBASE 설정 정보 입력]
        // 깃허브 배포 시 본인의 Firebase 프로젝트 설정 키값을 아래 객체에 입력해 주십시오.
        // =========================================================================
        const firebaseConfig = {
          apiKey: "AIzaSyChTj-BwhtnWcZkDHY1qj9cMPdDzK990A0",
          authDomain: "class-bank-50589.firebaseapp.com",
          projectId: "class-bank-50589",
          storageBucket: "class-bank-50589.firebasestorage.app",
          messagingSenderId: "958817151673",
          appId: "1:958817151673:web:8540e79888a17294cc0968",
          measurementId: "G-PY3H89ETJE"
        };
        
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        const fs = firebase.firestore();
        const storage = firebase.storage();

        // 글로벌 로딩 스피너 제어 함수
        function showSpinner(text = "데이터 처리 중...") {
            const spinner = document.getElementById('loading-spinner');
            const spinnerText = document.getElementById('loading-spinner-text');
            if (spinner) {
                if (spinnerText) spinnerText.innerText = text;
                spinner.style.display = "flex";
            }
        }
        function hideSpinner() {
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.style.display = "none";
        }

        // 글로벌 메모리 데이터베이스 캐시 객체
        let db = {
            students: [],
            jobs: [],
            transactions: [],
            savings: [],
            shop: [],
            pendingPayments: [],
            useRequests: [],
            shopPurchaseLog: [],
            tax: { totalTax: 120 },
            taxTransactions: [],
            taxGoals: [],
            deductReasons: {},
            inventory: [],
            envReports: [],
            newsFlash: null,
            salaryHistories: {},
            policies: {
                freeRate: 2.0,
                savingRate: 10.0,
                savingTerm: 3,
                approvalLimit: 150,
                minSavingAmount: 10,
                currencyName: "치킨",
                currencyIcon: null,
                dailyPurchaseLimit: 5
            },
            envSettings: {
                plateReward: 5,
                handkerchiefReward: 3
            },
            envActivityTypes: [
                { id: "act_1", name: "분리수거", reward: 20 },
                { id: "act_2", name: "교실 청소", reward: 30 },
                { id: "act_3", name: "에너지 절약", reward: 10 },
                { id: "act_4", name: "기타", reward: 15 }
            ],
            monthlyAttendance: [],
            systemSettings: {
                logoImage: null,
                shopActive: true,
                bankActive: true,
                envExchangeActive: true,
                envExampleText: "예시: 급식판을 깨끗이 비우고 사진을 찍어 올려주세요!",
                envExampleImage: null,
                shopHours: "평일 09:00 ~ 16:00",
                shopNotice: "주의: 상품 구매 후 취소 및 환불은 선생님께 직접 요청해야 합니다."
            }
        };

        function getDB() {
            return db;
        }

        function saveDB(newDb) {
            db = newDb;
        }

        // Firestore 실시간 스냅샷 바인딩 함수
        function initFirestoreListeners() {
            const onError = (colName, err) => {
                console.error(`Firestore onSnapshot error in collection [${colName}]:`, err);
                alert(`데이터베이스 실시간 로드에 실패했습니다. [컬렉션: ${colName}] (에러: ${err.message})`);
            };

            // 1. users 컬렉션
            fs.collection("users").onSnapshot(snapshot => {
                const students = [];
                snapshot.forEach(doc => {
                    const sData = doc.data();
                    students.push({
                        ...sData,
                        id: doc.id // Firestore 문서 ID를 id 필드로 바인딩
                    });
                });
                db.students = students.filter(s => s.id !== "teacher");
                initialLoadState.users = true;

                // 마일리지 직접 지급용 드롭다운 실시간 연동
                updateMileageStudentSelect(db.students);

                onDBChange("users");
                checkAllLoaded();
            }, err => onError("users", err));
            
            // 2. jobs 컬렉션
            fs.collection("jobs").onSnapshot(snapshot => {
                const jobs = [];
                snapshot.forEach(doc => {
                    jobs.push(doc.data());
                });
                db.jobs = jobs;
                initialLoadState.jobs = true;
                onDBChange("jobs");
                checkAllLoaded();
            }, err => onError("jobs", err));
            
            // 3. transactions 컬렉션
            fs.collection("transactions").onSnapshot(snapshot => {
                const txs = [];
                snapshot.forEach(doc => {
                    txs.push(doc.data());
                });
                db.transactions = txs;
                initialLoadState.transactions = true;
                onDBChange("transactions");
                checkAllLoaded();
            }, err => onError("transactions", err));
            
            // 4. shop_items 컬렉션
            fs.collection("shop_items").onSnapshot(snapshot => {
                const items = [];
                snapshot.forEach(doc => {
                    items.push(doc.data());
                });
                db.shop = items;
                initialLoadState.shop = true;
                onDBChange("shop_items");
                checkAllLoaded();
            }, err => onError("shop_items", err));
            
            // 5. shop_orders 컬렉션
            fs.collection("shop_orders").onSnapshot(snapshot => {
                const orders = [];
                snapshot.forEach(doc => {
                    orders.push(doc.data());
                });
                db.pendingPayments = orders.filter(o => o.type === "purchase_request");
                db.useRequests = orders.filter(o => o.type === "use_request");
                db.shopPurchaseLog = orders.filter(o => o.type === "completed_purchase" || o.type === "completed_use");
                initialLoadState.shop_orders = true;
                onDBChange("shop_orders");
                checkAllLoaded();
            }, err => onError("shop_orders", err));
            
            // 6. env_reports 컬렉션
            fs.collection("env_reports").onSnapshot(snapshot => {
                const reports = [];
                snapshot.forEach(doc => {
                    reports.push(doc.data());
                });
                db.envReports = reports;
                initialLoadState.env_reports = true;
                onDBChange("env_reports");
                checkAllLoaded();
            }, err => onError("env_reports", err));
            
            // 7. env_attendance 컬렉션
            fs.collection("env_attendance").onSnapshot(snapshot => {
                const atts = [];
                snapshot.forEach(doc => {
                    atts.push(doc.data());
                });
                db.monthlyAttendance = atts;
                initialLoadState.env_attendance = true;
                onDBChange("env_attendance");
                checkAllLoaded();
            }, err => onError("env_attendance", err));
            
            // 8. bank_savings 컬렉션
            fs.collection("bank_savings").onSnapshot(snapshot => {
                const savings = [];
                snapshot.forEach(doc => {
                    savings.push(doc.data());
                });
                db.savings = savings;
                initialLoadState.bank_savings = true;
                onDBChange("bank_savings");
                checkAllLoaded();
            }, err => onError("bank_savings", err));
            
            // 9. tax 컬렉션의 state 문서
            fs.collection("tax").doc("state").onSnapshot(doc => {
                if (doc.exists) {
                    db.tax = doc.data();
                } else {
                    db.tax = { totalTax: 120 };
                }
                initialLoadState.tax = true;
                onDBChange("tax");
                checkAllLoaded();
            }, err => onError("tax", err));
            
            // 10. tax_transactions 컬렉션
            fs.collection("tax_transactions").onSnapshot(snapshot => {
                const txs = [];
                snapshot.forEach(doc => {
                    txs.push(doc.data());
                });
                db.taxTransactions = txs;
                initialLoadState.tax_transactions = true;
                onDBChange("tax_transactions");
                checkAllLoaded();
            }, err => onError("tax_transactions", err));
            
            // 11. tax_goals 컬렉션
            fs.collection("tax_goals").onSnapshot(snapshot => {
                const goals = [];
                snapshot.forEach(doc => {
                    goals.push(doc.data());
                });
                db.taxGoals = goals;
                initialLoadState.tax_goals = true;
                onDBChange("tax_goals");
                checkAllLoaded();
            }, err => onError("tax_goals", err));
            
            // 12. settings 컬렉션의 system 문서
            fs.collection("settings").doc("system").onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    db.systemSettings = {
                        logoImage: data.logoImage,
                        shopActive: data.shopActive,
                        bankActive: data.bankActive,
                        envExchangeActive: data.envExchangeActive,
                        envExampleText: data.envExampleText,
                        envExampleImage: data.envExampleImage,
                        shopHours: data.shopHours,
                        shopNotice: data.shopNotice
                    };
                    db.policies = {
                        freeRate: data.freeRate || 2.0,
                        savingRate: data.savingRate || 10.0,
                        savingTerm: data.savingTerm || 3,
                        approvalLimit: data.approvalLimit || 150,
                        minSavingAmount: data.minSavingAmount || 10,
                        currencyName: data.currencyName || "치킨",
                        currencyIcon: data.currencyIcon || null,
                        dailyPurchaseLimit: data.dailyPurchaseLimit || 5
                    };
                    db.envSettings = data.envSettings || { plateReward: 5, handkerchiefReward: 3 };
                }
                initialLoadState.settings = true;
                onDBChange("settings");
                checkAllLoaded();
            }, err => onError("settings", err));

            // 13. env_mileage_ledger 컬렉션
            fs.collection("env_mileage_ledger").onSnapshot(snapshot => {
                const ledgers = [];
                snapshot.forEach(doc => {
                    ledgers.push(doc.data());
                });
                db.envMileageLedger = ledgers;
                initialLoadState.env_mileage_ledger = true;
                onDBChange("env_mileage_ledger");
                checkAllLoaded();
            }, err => onError("env_mileage_ledger", err));

            // 14. inventory 컬렉션
            fs.collection("inventory").onSnapshot(snapshot => {
                const invs = [];
                snapshot.forEach(doc => {
                    invs.push(doc.data());
                });
                db.inventory = invs;
                initialLoadState.inventory = true;
                onDBChange("inventory");
                checkAllLoaded();
            }, err => onError("inventory", err));
        }

        function onDBChange(source) {
            updateLogo();
            updateCurrencyUnits();
            if (currentUser) {
                loadTabData(activeTab);
            }
        }

        // 최초 로컬 데이터 마이그레이션 함수
        async function checkAndMigrateLocalStorageToFirestore() {
            const systemDoc = await fs.collection("settings").doc("system").get();
            if (!systemDoc.exists) {
                const localDataStr = localStorage.getItem('class_bank_db');
                if (localDataStr) {
                    try {
                        showSpinner("로컬 데이터를 클라우드로 마이그레이션하는 중...");
                        const localDB = JSON.parse(localDataStr);
                        
                        await fs.collection("settings").doc("system").set({
                            bankName: localDB.systemSettings.bankName || "양반후반 학급 은행",
                            logoImage: localDB.systemSettings.logoImage || null,
                            shopActive: localDB.systemSettings.shopActive !== false,
                            bankActive: localDB.systemSettings.bankActive !== false,
                            envExchangeActive: localDB.systemSettings.envExchangeActive !== false,
                            envExampleText: localDB.systemSettings.envExampleText || "예시...",
                            envExampleImage: localDB.systemSettings.envExampleImage || null,
                            shopHours: localDB.systemSettings.shopHours || "평일 09:00 ~ 16:00",
                            shopNotice: localDB.systemSettings.shopNotice || "주의...",
                            freeRate: localDB.policies.freeRate || 2.0,
                            savingRate: localDB.policies.savingRate || 10.0,
                            savingTerm: localDB.policies.savingTerm || 3,
                            approvalLimit: localDB.policies.approvalLimit || 150,
                            minSavingAmount: localDB.policies.minSavingAmount || 10,
                            currencyName: localDB.policies.currencyName || "치킨",
                            currencyIcon: localDB.policies.currencyIcon || null,
                            dailyPurchaseLimit: localDB.policies.dailyPurchaseLimit || 5,
                            envSettings: localDB.envSettings || { plateReward: 5, handkerchiefReward: 3 }
                        });
                        
                        for (const student of localDB.students) {
                            await fs.collection("users").doc(student.id).set(student);
                        }
                        
                        await fs.collection("users").doc("teacher").set({
                            id: "teacher",
                            name: "선생님",
                            password: "1234",
                            role: "teacher"
                        });
                        
                        for (const job of localDB.jobs) {
                            await fs.collection("jobs").doc(job.name).set(job);
                        }
                        
                        for (const tx of localDB.transactions) {
                            const txId = tx.id || "tx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                            await fs.collection("transactions").doc(txId).set({ ...tx, id: txId });
                        }
                        
                        for (const item of localDB.shop) {
                            await fs.collection("shop_items").doc(item.id).set(item);
                        }
                        
                        await fs.collection("tax").doc("state").set(localDB.tax || { totalTax: 120 });
                        
                        if (localDB.taxTransactions) {
                            for (const ttx of localDB.taxTransactions) {
                                const ttxId = ttx.id || "ttx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                                await fs.collection("tax_transactions").doc(ttxId).set({ ...ttx, id: ttxId });
                            }
                        }
                        
                        for (const goal of localDB.taxGoals) {
                            await fs.collection("tax_goals").doc(goal.id).set(goal);
                        }
                        
                        if (localDB.envReports) {
                            for (const rep of localDB.envReports) {
                                const repId = rep.id || "rep_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                                await fs.collection("env_reports").doc(repId).set({ ...rep, id: repId });
                            }
                        }
                        
                        if (localDB.monthlyAttendance) {
                            for (const att of localDB.monthlyAttendance) {
                                const attId = att.date || "att_" + Date.now();
                                await fs.collection("env_attendance").doc(attId).set(att);
                            }
                        }
                        
                        if (localDB.savings) {
                            for (const sav of localDB.savings) {
                                const savId = sav.id || "sav_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                                await fs.collection("bank_savings").doc(savId).set({ ...sav, id: savId });
                            }
                        }

                        if (localDB.envMileageLedger) {
                            for (const eml of localDB.envMileageLedger) {
                                const emlId = eml.id || "eml_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                                await fs.collection("env_mileage_ledger").doc(emlId).set({ ...eml, id: emlId });
                            }
                        }

                        if (localDB.inventory) {
                            for (const inv of localDB.inventory) {
                                const invId = inv.id || "inv_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                                await fs.collection("inventory").doc(invId).set({ ...inv, id: invId });
                            }
                        }
                        
                        showToast("🎉 로컬 데이터를 성공적으로 클라우드 DB로 이식했습니다!", "success");
                    } catch (err) {
                        console.error("이식 오류: ", err);
                        showToast("데이터 이식 중 에러 발생", "danger");
                    } finally {
                        hideSpinner();
                    }
                }
            }
        }

        // --- 실시간 SVG 기반 아바타 HTML 생성기 ---
        function generateAvatarHTML(avatar) {
            if (!avatar) avatar = { emoji: "👶", bgColor: "#ffe3e3" };
            if (!avatar.emoji) {
                avatar = { emoji: "👶", bgColor: "#ffe3e3" };
            }
            return `<div style="background-color: ${avatar.bgColor}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; border-radius: 50%; user-select: none;">${avatar.emoji}</div>`;
        }

        // ==========================================
        // 1.2. LOGO CUSTOMIZATION & SYSTEM CONFIG HANDLERS
        // ==========================================
        function updateLogo() {
            const db = getDB();
            const logoContainer = document.getElementById('header-logo-container');
            const loginLogoContainer = document.getElementById('login-logo-container');
            const bankName = (db.systemSettings && db.systemSettings.bankName) ? db.systemSettings.bankName : '학급 은행';
            
            // 탭 타이틀 이모지 필터링용 정규식 (유니코드 이모지 전체 범위 및 특정 닭다리/이삭 이모지)
            const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}🌾🍗]/gu;
            const cleanBankName = bankName.replace(emojiRegex, '').trim();

            if (db.systemSettings && db.systemSettings.logoImage) {
                const imgHTML = `<img src="${db.systemSettings.logoImage}" style="height: 35px; max-width: 150px; object-fit: contain; border-radius: 4px; vertical-align: middle; margin-right: 8px;">`;
                if (logoContainer) {
                    // 기존 이모지가 들어있던 span 요소 선택하여 비우고 display: none
                    const existingSpan = logoContainer.querySelector('span');
                    if (existingSpan) {
                        existingSpan.innerHTML = "";
                        existingSpan.style.display = "none";
                    }
                    // 기존 img 중복 렌더링 방지
                    const oldImg = logoContainer.querySelector('img');
                    if (oldImg) oldImg.remove();
                    
                    logoContainer.innerHTML = `${imgHTML} ${bankName}`;
                }
                if (loginLogoContainer) {
                    loginLogoContainer.innerHTML = `<img src="${db.systemSettings.logoImage}" style="height: 80px; max-width: 250px; object-fit: contain; border-radius: 8px;">`;
                }
                // 브라우저 탭 타이틀에서 기존 이모지 완전히 제거
                document.title = `${cleanBankName} - 경제 교육 플랫폼`;
            } else {
                if (logoContainer) {
                    logoContainer.innerHTML = `<span>🍗</span> ${bankName}`;
                    const existingSpan = logoContainer.querySelector('span');
                    if (existingSpan) {
                        existingSpan.style.display = "inline";
                    }
                }
                if (loginLogoContainer) {
                    loginLogoContainer.innerHTML = `🍗`;
                }
                // 파비콘 이모지가 🍗이므로 브라우저 탭 타이틀에 기본 이모지 🍗 추가
                document.title = `🍗 ${cleanBankName} - 팝콘/치킨 학급 은행`;
            }

            // 브라우저 탭 아이콘(Favicon) 동적 업데이트
            let faviconLink = document.querySelector("link[rel~='icon']");
            if (!faviconLink) {
                faviconLink = document.createElement('link');
                faviconLink.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(faviconLink);
            }
            if (db.systemSettings && db.systemSettings.logoImage) {
                faviconLink.href = db.systemSettings.logoImage;
            } else {
                const canvas = document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 32;
                const ctx = canvas.getContext('2d');
                ctx.font = '28px serif';
                ctx.fillText('🍗', 0, 26);
                faviconLink.href = canvas.toDataURL();
            }
        }

        function handleLogoUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            // 파일 크기 제한 (5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast("이미지 파일 크기는 5MB 이하여야 합니다.", "danger");
                event.target.value = "";
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                const db = getDB();
                db.systemSettings.logoImage = e.target.result;
                saveDB(db);
                updateLogo();
                showToast("🎉 학급 로고 이미지가 변경되었습니다.", "success");
            };
            reader.onerror = function() {
                showToast("이미지 파일 읽기에 실패했습니다.", "danger");
            };
            reader.readAsDataURL(file);
        }

        function handleLogoReset() {
            const db = getDB();
            db.systemSettings.logoImage = null;
            saveDB(db);
            updateLogo();
            document.getElementById('system-logo-input').value = "";
            showToast("🍗 기본 닭다리 이모지 로고로 환원되었습니다.", "info");
        }

        function handleCurrencyUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            if (file.size > 5 * 1024 * 1024) {
                showToast("이미지 용량은 최대 5MB를 초과할 수 없습니다.", "danger");
                event.target.value = "";
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                const db = getDB();
                if (!db.policies) db.policies = {};
                db.policies.currencyIcon = e.target.result;
                saveDB(db);
                updateCurrencyUnits();
                const activeNav = document.querySelector('.nav-item.active');
                if (activeNav && currentUser) {
                    const tabId = activeNav.id.replace('nav-', '');
                    loadTabData(tabId);
                }
                showToast("🎉 커스텀 화폐 아이콘이 변경되었습니다.", "success");
            };
            reader.onerror = function() {
                showToast("이미지 파일 읽기에 실패했습니다.", "danger");
            };
            reader.readAsDataURL(file);
        }

        function handleCurrencyReset() {
            const db = getDB();
            if (!db.policies) db.policies = {};
            db.policies.currencyIcon = null;
            saveDB(db);
            if (document.getElementById('system-currency-input')) {
                document.getElementById('system-currency-input').value = "";
            }
            updateCurrencyUnits();
            const activeNav = document.querySelector('.nav-item.active');
            if (activeNav && currentUser) {
                const tabId = activeNav.id.replace('nav-', '');
                loadTabData(tabId);
            }
            showToast("🪙 기본 화폐 텍스트(치킨)로 환원되었습니다.", "info");
        }

        function getCurrencyName() {
            const db = getDB();
            if (db.policies && db.policies.currencyName) {
                return db.policies.currencyName;
            }
            return "치킨";
        }

        function handleSaveCurrencyName() {
            const nameInput = document.getElementById('system-currency-name-input');
            const newName = nameInput ? nameInput.value.trim() : '';
            if (!newName) {
                showToast("화폐 단위를 입력해 주세요.", "danger");
                return;
            }
            const db = getDB();
            if (!db.policies) db.policies = {};
            db.policies.currencyName = newName;
            saveDB(db);
            
            // 모든 탭의 렌더링에 동기화 반영
            updateCurrencyUnits();
            const activeNav = document.querySelector('.nav-item.active');
            if (activeNav && currentUser) {
                const tabId = activeNav.id.replace('nav-', '');
                loadTabData(tabId);
            }
            showToast(`🪙 화폐 단위가 "${newName}"으로 전역 설정되었습니다.`, "success");
        }

        function renderStudentBalanceDisplay(balance) {
            const db = getDB();
            const icon = db.policies && db.policies.currencyIcon;
            const unit = getCurrencyName();
            
            let iconHTML = "";
            if (icon) {
                iconHTML = `<img src="${icon}" style="width: 24px; height: 24px; object-fit: contain; vertical-align: middle; margin-right: 4px;" alt="화폐">`;
            } else {
                iconHTML = `<span style="font-size: 1.2rem; vertical-align: middle; margin-right: 4px;">🍗</span>`;
            }
            
            // 금액 숫자 앞에 이미지 배치!
            const content = `내 잔액: ${iconHTML}<strong style="color: #d97706; margin-left: 2px;">${balance.toLocaleString()}</strong> <span style="margin-left: 4px; font-weight: bold; color: var(--text-main);">${unit}</span>`;
            
            const salEl = document.getElementById('salary-balance-display');
            const bankEl = document.getElementById('bank-balance-display');
            const shopEl = document.getElementById('shop-balance-display');
            
            if (salEl) salEl.innerHTML = content;
            if (bankEl) bankEl.innerHTML = content;
            if (shopEl) shopEl.innerHTML = content;
        }

        function updateCurrencyUnits() {
            const unit = getCurrencyName();
            const units = document.querySelectorAll('.currency-unit');
            units.forEach(el => {
                // 웹앱 내 일반 텍스트 영역에는 이미지가 아닌 순수 텍스트만 출력되도록 보정
                el.innerHTML = unit;
            });
        }

        function handleSaveBankName() {
            const nameInput = document.getElementById('system-bank-name-input');
            const newName = nameInput ? nameInput.value.trim() : '';
            if (!newName) {
                showToast("학급/은행 이름을 입력해 주세요.", "danger");
                return;
            }
            const db = getDB();
            db.systemSettings.bankName = newName;
            saveDB(db);
            updateLogo();
            showToast(`🏫 학급 이름이 "${newName}"으로 변경되었습니다.`, "success");
        }

        function handleSystemToggle(settingKey, isChecked) {
            const db = getDB();
            db.systemSettings[settingKey] = isChecked;
            saveDB(db);
            showToast(`⚙️ 설정이 ${isChecked ? '활성화' : '비활성화'} 되었습니다.`, "success");
            
            // 연동 화면 강제 갱신
            loadTabData(activeTab);
        }

        let tempEnvGuideImage = null;

        function handleEnvGuideImageUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                tempEnvGuideImage = e.target.result;
                const previewDiv = document.getElementById('system-env-guide-image-preview');
                previewDiv.querySelector('img').src = tempEnvGuideImage;
                previewDiv.style.display = "block";
            };
            reader.readAsDataURL(file);
        }

        function handleEnvGuideImageReset() {
            tempEnvGuideImage = null;
            const db = getDB();
            db.systemSettings.envExampleImage = null;
            saveDB(db);
            
            const previewDiv = document.getElementById('system-env-guide-image-preview');
            previewDiv.querySelector('img').src = "";
            previewDiv.style.display = "none";
            document.getElementById('system-env-guide-image-input').value = "";
            showToast("🗑️ 예시 사진이 초기화되었습니다.", "info");
        }

        function handleSaveEnvGuide() {
            const db = getDB();
            const text = document.getElementById('system-env-guide-text').value.trim();
            
            db.systemSettings.envExampleText = text;
            if (tempEnvGuideImage !== null) {
                db.systemSettings.envExampleImage = tempEnvGuideImage;
            }
            
            saveDB(db);
            showToast("🌿 환경 실천 보고서 예시 가이드가 저장되었습니다.", "success");
            
            if (activeTab === "environment") {
                loadTabData("environment");
            }
        }

        function renderSystemTab() {
            const db = getDB();
            const settings = db.systemSettings;
            
            // 학급/은행 이름 바인딩
            const bankNameInput = document.getElementById('system-bank-name-input');
            if (bankNameInput) bankNameInput.value = settings.bankName || '';

            // 학급 화폐 단위 명칭 바인딩
            const currencyNameInput = document.getElementById('system-currency-name-input');
            if (currencyNameInput) {
                currencyNameInput.value = (db.policies && db.policies.currencyName) ? db.policies.currencyName : '치킨';
            }

            document.getElementById('toggle-shop-active').checked = settings.shopActive;
            document.getElementById('toggle-bank-active').checked = settings.bankActive;
            document.getElementById('toggle-env-exchange-active').checked = settings.envExchangeActive;
            
            document.getElementById('system-env-guide-text').value = settings.envExampleText || "";
            
            const previewDiv = document.getElementById('system-env-guide-image-preview');
            if (settings.envExampleImage) {
                tempEnvGuideImage = settings.envExampleImage;
                previewDiv.querySelector('img').src = settings.envExampleImage;
                previewDiv.style.display = "block";
            } else {
                tempEnvGuideImage = null;
                previewDiv.querySelector('img').src = "";
                previewDiv.style.display = "none";
            }
        }

        // ==========================================
        // 2. STATE & USER SECTIONS CONTROL
        // ==========================================
        let currentUser = null; // { id, name, role }
        let activeTab = "bankbook";
        let tempCSVData = []; // CSV 업로드용 임시 공간
        let editingOriginalJobName = null; // 직업 수정용 임시 공간
let editingStudentId = null; // 학생 수정용 임시 공간

        let isInitialLoadComplete = false;
        const initialLoadState = {
            users: false,
            jobs: false,
            transactions: false,
            shop: false,
            shop_orders: false,
            env_reports: false,
            env_attendance: false,
            bank_savings: false,
            tax: false,
            tax_transactions: false,
            tax_goals: false,
            settings: false,
            env_mileage_ledger: false,
            inventory: false
        };

        function checkAllLoaded() {
            if (isInitialLoadComplete) return;
            const allLoaded = Object.values(initialLoadState).every(loaded => loaded);
            if (allLoaded) {
                isInitialLoadComplete = true;
                onInitialLoadSuccess();
            }
        }

        async function onInitialLoadSuccess() {
            try {
                await checkAndMigrateLocalStorageToFirestore();
            } catch (err) {
                console.error("데이터베이스 마이그레이션 실패: ", err);
                alert("데이터베이스 마이그레이션에 실패했습니다. (에러: " + err.message + ")");
            }
            checkAutoLogin();
            hideSpinner();
        }

        async function handleLogin() {
            const id = document.getElementById('login-id').value.trim();
            const pw = document.getElementById('login-pw').value.trim();

            if (!id || !pw) {
                showToast("아이디와 비밀번호를 입력해 주세요.", "danger");
                return;
            }

            const loginBtn = document.getElementById('btn-login');
            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.innerText = "로그인 중...";
            }
            showSpinner("로그인 검증 중...");

            try {
                if (id === "teacher") {
                    if (pw === "1234") {
                        localStorage.setItem('class_bank_auth_token', 'teacher');
                        setCurrentUser("teacher", "선생님", "teacher");
                        switchTab("salary");
                        showToast("🎉 교사용 관리 권한으로 접속했습니다.", "success");
                    } else {
                        alert("🚫 아이디 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.");
                        showToast("🚫 아이디 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.", "danger");
                    }
                    return;
                }

                // Firestore users 컬렉션에서 검증
                const userDoc = await fs.collection("users").doc(id).get();
                if (userDoc.exists) {
                    const student = userDoc.data();
                    if (student.password === pw) {
                        if (student.isFrozen) {
                            showFreezeScreen();
                            return;
                        }

                        localStorage.setItem('class_bank_auth_token', student.id);
                        setCurrentUser(student.id, student.name, "student");
                        switchTab("salary");
                        showToast(`🎈 환영합니다, ${student.name} 학생!`, "success");
                    } else {
                        alert("🚫 아이디 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.");
                        showToast("🚫 아이디 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.", "danger");
                    }
                } else {
                    alert("🚫 아이디 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.");
                    showToast("🚫 아이디 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.", "danger");
                }
            } catch (err) {
                console.error("로그인 에러: ", err);
                alert("데이터베이스 조회에 실패했습니다. (에러: " + err.message + ")");
                showToast("통신 오류가 발생했습니다.", "danger");
            } finally {
                hideSpinner();
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.innerText = "로그인";
                }
            }
        }

        window.addEventListener('DOMContentLoaded', () => {
            showSpinner("클라우드 데이터베이스에서 데이터를 실시간으로 가져오는 중입니다...");
            
            // Firestore 리스너 가동
            initFirestoreListeners();
            
            // 실시간 적금 시간 갱신 및 이자 정산 타이머 가동 (1초 간격)
            setInterval(updateSavingsTimeRemaining, 1000);
            
            // 자유 예금 월 이자 정산 스케줄러 등록
            monthlyInterest(); // 로딩 시 즉시 1회 체크
            setInterval(monthlyInterest, 10000); // 10초마다 자동 체크
        });

        function checkAutoLogin() {
            const token = localStorage.getItem('class_bank_auth_token');
            if (token) {
                const db = getDB();
                const student = db.students.find(s => s.id === token);
                if (student) {
                    if (student.isFrozen) {
                        showFreezeScreen();
                        return;
                    }
                    setCurrentUser(student.id, student.name, "student");
                    switchTab("salary");
                    showToast("🔓 자동 로그인되었습니다.", "success");
                    return;
                } else if (token === "teacher") {
                    setCurrentUser("teacher", "선생님", "teacher");
                    switchTab("salary"); // 기본 통장 탭으로 연결
                    showToast("🔓 교사 세션으로 자동 로그인되었습니다.", "success");
                    return;
                }
            }
            switchTab("login");
        }

        function logout() {
            localStorage.removeItem('class_bank_auth_token');
            currentUser = null;
            document.getElementById('logged-user-widget').style.display = "none";
            document.getElementById('main-navigation').style.display = "none";
            document.getElementById('freeze-screen').style.display = "none";
            
            document.getElementById('login-id').value = "";
            document.getElementById('login-pw').value = "";

            switchTab("login");
            showToast("👋 안전하게 로그아웃되었습니다.", "info");
        }

        function showFreezeScreen() {
            document.getElementById('freeze-screen').style.display = "flex";
        }

        function setCurrentUser(id, name, role) {
            currentUser = { id, name, role };
            const widget = document.getElementById('logged-user-widget');
            const avatar = document.getElementById('header-user-avatar');
            const roleBadge = document.getElementById('header-user-role');
            const nameSpan = document.getElementById('header-user-name');

            if (role === "teacher") {
                avatar.innerHTML = "🧑‍🏫";
            } else {
                const db = getDB();
                const student = db.students.find(s => s.id === id);
                if (student && student.avatar) {
                    avatar.innerHTML = generateAvatarHTML(student.avatar);
                } else {
                    avatar.innerHTML = "👶";
                }
            }
            roleBadge.innerText = role === "teacher" ? "선생님" : "학생";
            roleBadge.style.backgroundColor = role === "teacher" ? "var(--accent)" : "var(--primary-dark)";
            nameSpan.innerText = name;
            widget.style.display = "flex";

            const nav = document.getElementById('main-navigation');
            nav.style.display = "flex";

            // 교사용 계정관리 탭 설정
            const manageNav = document.getElementById('nav-manage');
            const mypageNav = document.getElementById('nav-mypage');
            if (role === "teacher") {
                manageNav.style.display = "flex";
                if (mypageNav) mypageNav.style.display = "none";
            } else {
                manageNav.style.display = "none";
                if (mypageNav) mypageNav.style.display = "flex";
            }
        }

        function switchTab(tabId) {
            if (!currentUser && tabId !== "login") {
                tabId = "login";
            }

            activeTab = tabId;

            const sections = document.querySelectorAll('.tab-section');
            sections.forEach(sec => sec.classList.remove('active'));
            
            const targetSection = document.getElementById(`tab-${tabId}`);
            if (targetSection) targetSection.classList.add('active');

            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => item.classList.remove('active'));

            const targetNav = document.getElementById(`nav-${tabId}`);
            if (targetNav) targetNav.classList.add('active');

            if (currentUser) {
                loadTabData(tabId);
            }
        }

        function loadTabData(tabId) {
            const db = getDB();
            
            // 로그인 유저 데이터 실시간 동기화 (Bug Fix)
            if (currentUser && currentUser.role === "student") {
                const latestStudent = db.students.find(x => x.id === currentUser.id);
                if (latestStudent) {
                    currentUser.balance = latestStudent.balance;
                    currentUser.mileage = latestStudent.mileage;
                    currentUser.mileageBalance = latestStudent.mileageBalance;
                    currentUser.avatar = latestStudent.avatar;
                }
            }

            const isTeacher = (currentUser.role === "teacher");

            // 탭 내부 조건부 뷰 전환
            const targetSec = document.getElementById(`tab-${tabId}`);
            if (targetSec) {
                const sViews = targetSec.querySelectorAll('.student-view');
                const tViews = targetSec.querySelectorAll('.teacher-view');
                sViews.forEach(v => v.style.display = isTeacher ? 'none' : 'block');
                tViews.forEach(v => v.style.display = isTeacher ? 'block' : 'none');
            }

            // 치킨 잔액 연동
            if (currentUser.role === "student") {
                const s = db.students.find(x => x.id === currentUser.id);
                if (s.isFrozen) {
                    showFreezeScreen();
                    return;
                } else {
                    const freezeScreen = document.getElementById('freeze-screen');
                    if (freezeScreen) freezeScreen.style.display = "none";
                }
                const balance = s.balance;
                renderStudentBalanceDisplay(balance);
            }

            switch(tabId) {
                case "salary":
                    if (isTeacher) renderTeacherSalaryTab(db);
                    else renderBankbook();
                    break;
                case "bank":
                    if (isTeacher) renderTeacherBankTab(db);
                    else renderBank();
                    break;
                case "shop":
                    if (isTeacher) renderTeacherShopTab(db);
                    else renderShop();
                    break;
                case "environment":
                    if (isTeacher) renderTeacherEnvTab(db);
                    else renderStudentEnvTab(db);
                    break;
                case "tax":
                    if (isTeacher) renderTeacherTaxTab(db);
                    else renderTax();
                    break;
                case "mypage":
                    renderMyPage();
                    break;
                case "manage":
                    if (isTeacher) {
                        switchSubTab(activeSubTab);
                    }
                    break;
            }
            updateCurrencyUnits();
        }

        // ==========================================
        // 3. TAB 1: BANKBOOK (SALARY) LOGIC
        // ==========================================
        function handleResetSalaryDateFilter() {
            document.getElementById('salary-start-date').value = "";
            document.getElementById('salary-end-date').value = "";
            renderBankbook();
        }

        function renderBankbook() {
            const db = getDB();
            const tbody = document.getElementById('salary-tbody');
            if (!tbody) return;
            tbody.innerHTML = "";

            // 잔액 필드 갱신
            const balanceEl = document.getElementById('salary-balance');
            const student = db.students.find(s => s.id === currentUser.id);
            if (balanceEl && student) {
                balanceEl.innerText = student.balance.toLocaleString();
            }

            // 날짜 필터 적용
            const startDateVal = document.getElementById('salary-start-date').value;
            const endDateVal = document.getElementById('salary-end-date').value;

            let myTx = db.transactions
                .filter(tx => tx.studentId === currentUser.id);

            if (startDateVal) {
                const startLimit = new Date(startDateVal + "T00:00:00");
                myTx = myTx.filter(tx => new Date(tx.date) >= startLimit);
            }
            if (endDateVal) {
                const endLimit = new Date(endDateVal + "T23:59:59");
                myTx = myTx.filter(tx => new Date(tx.date) <= endLimit);
            }

            myTx.sort((a,b) => new Date(b.date) - new Date(a.date));

            if (myTx.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">거래 내역이 아직 없습니다.</td></tr>`;
            } else {
                myTx.forEach(tx => {
                    const tr = document.createElement('tr');
                    if (tx.isSavingsMaturity) {
                        tr.classList.add('highlight-row');
                    }

                    const txDate = new Date(tx.date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const typeText = tx.type === "deposit" ? "📈 입금" : "📉 출금";
                    const amountText = (tx.type === "deposit" ? "+" : "-") + tx.amount.toLocaleString();
                    const amountColor = tx.type === "deposit" ? "#2ecc71" : "#e74c3c";

                    tr.innerHTML = `
                        <td>${txDate}</td>
                        <td style="color: ${amountColor}; font-weight: bold;">${typeText}</td>
                        <td style="color: ${amountColor}; font-weight: bold;">${amountText}</td>
                        <td>${tx.description}</td>
                        <td style="font-weight: bold;">${tx.balanceAfter.toLocaleString()}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            // 월급 명세서 (배열 구조) 렌더링
            const selectEl = document.getElementById('salary-month-select');
            const receiptDiv = document.getElementById('salary-receipt-content');
            
            if (receiptDiv) {
                receiptDiv.innerHTML = "";
                const histories = db.salaryHistories[currentUser.id] || [];

                if (histories.length === 0) {
                    if (selectEl) selectEl.innerHTML = `<option value="">명세서 없음</option>`;
                    receiptDiv.innerHTML = `
                        <div class="receipt-title">월급 명세서</div>
                        <p style="text-align:center; color:var(--text-muted); padding:30px 0;">아직 발행된 월급 내역이 없습니다.</p>
                    `;
                } else {
                    // 셀렉트 박스 바인딩
                    const currentSelected = selectEl ? selectEl.value : "";
                    if (selectEl) {
                        selectEl.innerHTML = "";
                        // 역순 정렬
                        const sortedHist = [...histories].sort((a,b) => new Date(b.date) - new Date(a.date));
                        sortedHist.forEach(h => {
                            const opt = document.createElement('option');
                            opt.value = h.id;
                            const d = new Date(h.date);
                            opt.innerText = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 지급분`;
                            selectEl.appendChild(opt);
                        });

                        // 이전 선택값 복구 시도, 없으면 가장 최근 것
                        if (currentSelected && sortedHist.find(h => h.id === currentSelected)) {
                            selectEl.value = currentSelected;
                        } else {
                            selectEl.value = sortedHist[0].id;
                        }
                    }

                    const activeId = selectEl ? selectEl.value : (histories[histories.length - 1].id);
                    const history = histories.find(h => h.id === activeId);

                    if (history) {
                        let totalAllowance = 0;
                        let totalDeduction = 0;

                        const allowancesHTML = history.allowances.map(item => {
                            totalAllowance += item.amount;
                            return `<div class="receipt-row"><span>${item.name}</span><span>+${item.amount} ${getCurrencyName()}</span></div>`;
                        }).join('');

                        const deductionsHTML = history.deductions.map(item => {
                            totalDeduction += item.amount;
                            return `<div class="receipt-row deduction"><span>${item.name}</span><span>-${item.amount} ${getCurrencyName()}</span></div>`;
                        }).join('');

                        const dateStr = new Date(history.date).toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' });

                        receiptDiv.innerHTML = `
                            <div class="receipt-title">월급 명세서</div>
                            <div class="receipt-meta">
                                <span>성명: <strong>${student ? student.name : currentUser.name}</strong></span>
                                <span>직업: <strong>${(student && student.job) || '무직'}</strong></span>
                            </div>
                            <div class="receipt-meta" style="margin-top:-10px; margin-bottom:15px;">
                                <span>지급일: ${dateStr}</span>
                            </div>
                            
                            <div class="receipt-section-title">➕ 지급 내역 (Allowances)</div>
                            ${allowancesHTML}
                            
                            <div class="receipt-section-title">➖ 공제 내역 (Deductions)</div>
                            ${deductionsHTML}
                            
                            <div class="receipt-section-title" style="border-bottom:1px dashed #ccc; padding-bottom:8px;">🧑‍🏫 선생님의 한마디</div>
                            <p style="font-size:0.85rem; color:#d9480f; background:#fffbeb; padding:10px; border-radius:8px; border:1px solid #ffe066; font-style:italic; line-height:1.4;">
                                "${history.comment}"
                            </p>
                            
                            <div class="receipt-total">
                                <span>실수령액</span>
                                <span style="color: #2b8a3e;">${history.netSalary.toLocaleString()} ${getCurrencyName()}</span>
                            </div>
                        `;
                    }
                }
            }
        }

        // --- 교사용 월급 지급 탭 렌더링 ---
        function renderTeacherSalaryTab(db) {
            // 월급 대상 학생 드롭다운
            const targetSelect = document.getElementById('salary-target-student');
            if (targetSelect) {
                targetSelect.innerHTML = `<option value="all">학급 전체 학생 일괄 지급</option>`;
                db.students.forEach(st => {
                    const opt = document.createElement('option');
                    opt.value = st.id;
                    opt.innerText = `${st.name} (${st.id} - ${st.job || '무직'})`;
                    targetSelect.appendChild(opt);
                });
            }

            // 직업 연동 선택 드롭다운
            const jobSelect = document.getElementById('salary-job-select');
            if (jobSelect) {
                jobSelect.innerHTML = `<option value="">직업 직접 입력/선택 안함</option>`;
                db.jobs.forEach(job => {
                    if (job.name !== '무직') {
                        const opt = document.createElement('option');
                        opt.value = job.name;
                        opt.innerText = `${job.name} (기본급: ${job.baseSalary}${getCurrencyName()})`;
                        jobSelect.appendChild(opt);
                    }
                });
            }

            // 최근 급여 지급 명세서 목록 렌더링
            const historyTbody = document.getElementById('teacher-salary-history-tbody');
            if (historyTbody) {
                historyTbody.innerHTML = "";
                const allHistories = [];
                for (let studentId in db.salaryHistories) {
                    const student = db.students.find(s => s.id === studentId);
                    const list = db.salaryHistories[studentId];
                    if (Array.isArray(list)) {
                        list.forEach(h => {
                            allHistories.push({
                                studentId: studentId,
                                studentName: student ? student.name : studentId,
                                studentJob: (student && student.job) || "무직",
                                ...h
                            });
                        });
                    }
                }

                allHistories.sort((a, b) => new Date(b.date) - new Date(a.date));

                if (allHistories.length === 0) {
                    historyTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">최근 지급된 월급 내역이 없습니다.</td></tr>`;
                } else {
                    allHistories.forEach(h => {
                        const tr = document.createElement('tr');
                        const dateStr = new Date(h.date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        
                        let totalDeduct = 0;
                        if (Array.isArray(h.deductions)) {
                            h.deductions.forEach(d => totalDeduct += d.amount);
                        }

                        tr.innerHTML = `
                            <td>${dateStr}</td>
                            <td><strong>${h.studentName} (${h.studentId})</strong></td>
                            <td>${h.studentJob}</td>
                            <td>${h.base.toLocaleString()} ${getCurrencyName()}</td>
                            <td style="color:#e74c3c;">-${totalDeduct.toLocaleString()} ${getCurrencyName()}</td>
                            <td style="font-weight:bold; color:#2b8a3e;">${h.netSalary.toLocaleString()} ${getCurrencyName()}</td>
                            <td>
                                <button class="btn btn-danger" style="font-size:0.7rem; padding:4px 8px;" onclick="handleRollbackSalary('${h.studentId}', '${h.txId}')">↩️ 지급 회수</button>
                            </td>
                        `;
                        historyTbody.appendChild(tr);
                    });
                }
            }

            autoCalcSalary();
            renderTeacherSalaryHistoryFiltered();
        }

        // 급여 명세서 날짜 범위 필터 렌더링 함수
        function renderTeacherSalaryHistoryFiltered() {
            const db = getDB();
            const historyTbody = document.getElementById('teacher-salary-history-tbody');
            if (!historyTbody) return;
            const dateFrom = (document.getElementById('salary-filter-date-from') || {}).value || '';
            const dateTo   = (document.getElementById('salary-filter-date-to')   || {}).value || '';
            const infoEl   = document.getElementById('salary-filter-info');
            const allHistories = [];
            for (let studentId in db.salaryHistories) {
                const student = db.students.find(s => s.id === studentId);
                const list = db.salaryHistories[studentId];
                if (Array.isArray(list)) {
                    list.forEach(h => { allHistories.push({ studentId, studentName: student ? student.name : studentId, studentJob: (student && student.job) || '무직', ...h }); });
                }
            }
            allHistories.sort((a, b) => new Date(b.date) - new Date(a.date));
            let filtered = allHistories;
            if (dateFrom) filtered = filtered.filter(h => h.date.slice(0,10) >= dateFrom);
            if (dateTo)   filtered = filtered.filter(h => h.date.slice(0,10) <= dateTo);
            historyTbody.innerHTML = '';
            if (filtered.length === 0) {
                historyTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">조건에 맞는 급여 내역이 없습니다.</td></tr>`;
            } else {
                filtered.forEach(h => {
                    const tr = document.createElement('tr');
                    const dateStr = new Date(h.date).toLocaleString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
                    let totalDeduct = 0;
                    if (Array.isArray(h.deductions)) h.deductions.forEach(d => totalDeduct += d.amount);
                    tr.innerHTML = `
                        <td>${dateStr}</td>
                        <td><strong>${h.studentName} (${h.studentId})</strong></td>
                        <td>${h.studentJob}</td>
                        <td>${h.base.toLocaleString()} ${getCurrencyName()}</td>
                        <td style="color:#e74c3c;">-${totalDeduct.toLocaleString()} ${getCurrencyName()}</td>
                        <td style="font-weight:bold; color:#2b8a3e;">${h.netSalary.toLocaleString()} ${getCurrencyName()}</td>
                        <td><button class="btn btn-danger" style="font-size:0.7rem; padding:4px 8px;" onclick="handleRollbackSalary('${h.studentId}', '${h.txId}')">↩️ 지급 회수</button></td>
                    `;
                    historyTbody.appendChild(tr);
                });
            }
            if (infoEl) infoEl.textContent = (dateFrom || dateTo) ? `필터 결과: ${filtered.length}건` : `전체: ${allHistories.length}건`;
        }

        // 급여 필터 초기화
        function clearSalaryFilter() {
            ['salary-filter-date-from','salary-filter-date-to'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
            renderTeacherSalaryHistoryFiltered();
        }

        // 월급 지급 롤백 실행
        function handleRollbackSalary(studentId, txId) {
            if (confirm("↩️ 이 월급 지급 내역을 회수(취소)하시겠습니까?\n해당 학생의 잔액에서 실수령액이 차감되고, 공제된 세액은 국고에서 차감됩니다.")) {
                const success = undoTransaction(txId);
                if (success) {
                    showToast("↩️ 월급 지급이 성공적으로 회수되었습니다.", "success");
                    loadTabData("salary");
                }
            }
        }

        // ==========================================
        // 학생 계정 수동 생성 기능
        // ==========================================

        // 미리보기 함수
        function previewNewStudent() {
            const name = document.getElementById('new-student-name').value.trim();
            const id = document.getElementById('new-student-id').value.trim();
            const pw = document.getElementById('new-student-pw').value.trim();
            const job = document.getElementById('new-student-job').value;
            const role = document.getElementById('new-student-role').value.trim();
            const balance = parseInt(document.getElementById('new-student-balance').value) || 0;

            if (!name || !id || !pw) {
                showToast("이름, 아이디, 비밀번호는 필수 항목입니다.", "danger");
                return;
            }

            document.getElementById('preview-name').innerText = name;
            document.getElementById('preview-id').innerText = id;
            document.getElementById('preview-pw').innerText = pw;
            document.getElementById('preview-job').innerText = job;
            document.getElementById('preview-role').innerText = role || '(없음)';
            document.getElementById('preview-balance').innerText = balance.toLocaleString();
            document.getElementById('new-student-preview').style.display = 'block';
        }

        // 폼 초기화
        function resetNewStudentForm() {
            document.getElementById('new-student-name').value = '';
            document.getElementById('new-student-id').value = '';
            document.getElementById('new-student-pw').value = '1234';
            document.getElementById('new-student-job').value = '무직';
            document.getElementById('new-student-role').value = '';
            document.getElementById('new-student-balance').value = '0';
            document.getElementById('new-student-preview').style.display = 'none';
        }

        // 학생 계정 생성 및 편집 함수
        function handleCreateStudent() {
            const name = document.getElementById('new-student-name').value.trim();
            const idField = document.getElementById('new-student-id');
            const newId = idField.value.trim();
            const pw = document.getElementById('new-student-pw').value.trim();
            const job = document.getElementById('new-student-job').value;
            const role = document.getElementById('new-student-role').value.trim();
            const balance = parseInt(document.getElementById('new-student-balance').value) || 0;

            // 유효성 검사
            if (!name) {
                showToast("학생 이름을 입력해 주세요.", "danger");
                document.getElementById('new-student-name').focus();
                return;
            }
            if (!newId) {
                showToast("로그인 아이디를 입력해 주세요.", "danger");
                idField.focus();
                return;
            }
            if (!/^[a-zA-Z0-9_]+$/.test(newId)) {
                showToast("아이디는 영문자, 숫자, 언더스코어(_)만 사용 가능합니다.", "danger");
                return;
            }
            if (newId === 'teacher') {
                showToast("'teacher'는 예약된 ID입니다. 다른 아이디를 사용해 주세요.", "danger");
                return;
            }
            if (!pw) {
                showToast("비밀번호를 입력해 주세요.", "danger");
                document.getElementById('new-student-pw').focus();
                return;
            }

            const db = getDB();

            // 직업 객체 조회 (baseSalary 참조)
            const jobObj = db.jobs.find(j => j.name === job);
            const baseSalary = jobObj ? jobObj.baseSalary : 50;

            if (editingStudentId) {
                // === EDIT MODE ===
                // Firestore 업데이트
                fs.collection("users").doc(editingStudentId).update({
                    name: name,
                    password: pw,
                    job: job,
                    role: role,
                    balance: balance,
                    baseSalary: baseSalary
                }).then(() => {
                    // 로컬 DB 동기화
                    const stu = db.students.find(s => s.id === editingStudentId);
                    if (stu) {
                        stu.name = name;
                        stu.password = pw;
                        stu.job = job;
                        stu.role = role;
                        stu.balance = balance;
                        stu.baseSalary = baseSalary;
                    }
                    saveDB(db);
                    showToast(`✅ 학생 계정(ID: ${editingStudentId})이 성공적으로 수정되었습니다!`, "success");
                    // UI 초기화
                    resetNewStudentForm();
                    editingStudentId = null;
                    const btn = document.getElementById('btn-create-student');
                    if (btn) btn.innerHTML = '생성';
                    renderTeacherManageTab(db);
                }).catch(err => {
                    console.error("학생 수정 실패:", err);
                    alert("학생 정보 수정에 실패했습니다. 보안 규칙을 확인하세요.");
                });
                return;
            }

            // === CREATE MODE ===
            // 중복 ID 검사
            const existing = db.students.find(s => s.id === newId);
            if (existing) {
                showToast(`❌ '${newId}' 아이디는 이미 존재하는 학생 계정입니다. 다른 아이디를 사용해 주세요.`, "danger");
                return;
            }

            const newStudent = {
                id: newId,
                name: name,
                password: pw,
                balance: balance,
                isFrozen: false,
                deviceId: null,
                job: job,
                role: role || "",
                baseSalary: baseSalary,
                mileage: 0,
                avatar: { emoji: "👶", bgColor: "#ffe3e3" }
            };

            db.students.push(newStudent);

            if (balance > 0) {
                db.transactions.push({
                    id: "tx_init_" + Date.now() + "_" + newId,
                    studentId: newId,
                    date: new Date().toISOString(),
                    description: `🎉 계정 생성 초기 지급금`,
                    type: "deposit",
                    amount: balance,
                    balanceAfter: balance,
                    isSavingsMaturity: false
                });
            }

            saveDB(db);
            showToast(`✅ ${name} 학생 계정(ID: ${newId})이 성공적으로 생성되었습니다!`, "success");
            resetNewStudentForm();
            renderTeacherManageTab(db);

            const btn = document.getElementById('btn-create-student');
            if (btn) {
                const origText = btn.innerHTML;
                btn.innerHTML = '🎉 생성 완료!';
                btn.style.background = '#2ecc71';
                setTimeout(() => {
                    btn.innerHTML = origText;
                    btn.style.background = '';
                }, 2000);
            }
        }

        // 편집 버튼 클릭 시 호출되는 함수
        function editStudent(studentId) {
            const db = getDB();
            const student = db.students.find(s => s.id === studentId);
            if (!student) return;
            // 폼에 데이터 바인딩
            document.getElementById('new-student-name').value = student.name || '';
            document.getElementById('new-student-id').value = student.id || '';
            document.getElementById('new-student-id').disabled = true; // ID는 변경 불가
            document.getElementById('new-student-pw').value = student.password || '';
            document.getElementById('new-student-job').value = student.job || '무직';
            document.getElementById('new-student-role').value = student.role || '';
            document.getElementById('new-student-balance').value = student.balance || 0;
            // 편집 모드 플래그 설정
            editingStudentId = studentId;
            // 버튼 텍스트 변경
            const btn = document.getElementById('btn-create-student');
            if (btn) btn.innerHTML = '수정 저장';
        }


        // ==========================================
        // SUB-TABS NAVIGATION IN MANAGE SECTION
        // ==========================================

        let activeSubTab = "account";
        function switchSubTab(subTabId) {
            activeSubTab = subTabId;
            const subtabs = document.querySelectorAll('.subtab-panel');
            subtabs.forEach(panel => panel.style.display = 'none');
            
            const targetPanel = document.getElementById(`subtab-${subTabId}`);
            if (targetPanel) targetPanel.style.display = 'block';

            const tabBtns = document.querySelectorAll('#tab-manage .bank-tab-btn');
            tabBtns.forEach(btn => btn.classList.remove('active'));

            const targetBtn = document.getElementById(`btn-subtab-${subTabId}`);
            if (targetBtn) targetBtn.classList.add('active');

            const db = getDB();
            renderTeacherManageTab(db);
        }

        function renderTeacherManageTab(db) {
            if (activeSubTab === "account") {
                // 새 학생 생성 폼의 직업 드롭다운 갱신
                const newJobSelect = document.getElementById('new-student-job');
                if (newJobSelect) {
                    newJobSelect.innerHTML = '<option value="무직">무직 (미배정)</option>';
                    db.jobs.forEach(job => {
                        if (job.name !== '무직') {
                            const opt = document.createElement('option');
                            opt.value = job.name;
                            opt.innerText = `${job.name} (기본급: ${job.baseSalary}${getCurrencyName()})`;
                            newJobSelect.appendChild(opt);
                        }
                    });
                }

                // 계정 관리: 잔액 & 마일리지 직접 관리 테이블 렌더링
                const stuTbody = document.getElementById('teacher-student-management-tbody');
                if (!stuTbody) return;
                stuTbody.innerHTML = "";
                db.students.forEach((student) => {
                    const mileage = student.mileageBalance !== undefined ? student.mileageBalance : (student.mileage || 0);
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${student.name}</strong><br><code style="font-size:0.72rem;color:#868e96;">${student.id}</code></td>
                        <td style="font-weight:bold; color:#d9480f;">${(student.balance || 0).toLocaleString()} ${getCurrencyName()}</td>
                        <td style="font-weight:bold; color:#0b7285;">${mileage} 점</td>
                        <td>
                            <input type="number" id="inp-bal-${student.id}"
                                placeholder="${(student.balance || 0).toLocaleString()}"
                                style="width:100%; padding:5px 7px; border:1px solid #ced4da; border-radius:6px; font-size:0.88rem; box-sizing:border-box;">
                        </td>
                        <td>
                            <input type="number" id="inp-mil-${student.id}"
                                placeholder="${mileage}"
                                style="width:100%; padding:5px 7px; border:1px solid #ced4da; border-radius:6px; font-size:0.88rem; box-sizing:border-box;">
                        </td>
                        <td>
                            <input type="text" id="inp-reason-${student.id}"
                                placeholder="예: 우수 발표 보상"
                                style="width:100%; padding:5px 7px; border:1px solid #ced4da; border-radius:6px; font-size:0.88rem; box-sizing:border-box;">
                        </td>
                        <td>
                            <button class="btn btn-success" style="font-size:0.75rem; padding:5px 10px; white-space:nowrap;"
                                onclick="applyBalanceChange('${student.id}')">✅ 적용</button>
                        </td>
                        <td>
                            <div style="display:flex; flex-direction:column; gap:4px;">
                                <button class="btn btn-primary" style="font-size:0.72rem; padding:3px 7px;" onclick="handleViewStudentDetail('${student.id}')">🔍 통장내역</button>
                                <button class="btn btn-warning" style="font-size:0.72rem; padding:3px 7px;" onclick="handleResetStudentPassword('${student.id}')">🔑 비번초기화</button>
                                <button class="btn btn-danger" style="font-size:0.72rem; padding:3px 7px;" onclick="deleteStudent('${student.id}')">🗑 삭제</button>
                                <label class="switch" style="margin-top:2px;">
                                    <input type="checkbox" ${student.isFrozen ? 'checked' : ''} onchange="toggleStudentFreeze('${student.id}', this.checked)">
                                    <span class="slider"></span>
                                </label>
                                <span style="font-size:0.7rem; color:var(--accent); font-weight:bold;">동결</span>
                            </div>
                        </td>
                    `;
                    stuTbody.appendChild(tr);
                });
            } else if (activeSubTab === "job") {
                // 직업 관리: 직업 목록 렌더링
                const jobsTbody = document.getElementById('teacher-jobs-tbody');
                if (jobsTbody) {
                    jobsTbody.innerHTML = "";
                    db.jobs.forEach(job => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td><strong>${job.name}</strong></td>
                            <td>${(job.baseSalary || 0).toLocaleString()} ${getCurrencyName()}</td>
                            <td>
                                <button class="btn btn-primary btn-edit-job" style="font-size:0.7rem; padding:4px 8px;">수정</button>
                                <button class="btn btn-danger btn-delete-job" style="font-size:0.7rem; padding:4px 8px; margin-left:4px;">삭제</button>
                            </td>
                        `;
                        // 안전한 클로저 기반 이벤트 리스너 바인딩
                        tr.querySelector('.btn-edit-job').addEventListener('click', () => handleEditJob(job.name));
                        tr.querySelector('.btn-delete-job').addEventListener('click', () => handleDeleteJob(job.name));
                        jobsTbody.appendChild(tr);
                    });
                }

                // 학생별 직업 지정 렌더링
                const stuJobTbody = document.getElementById('teacher-student-job-tbody');
                if (stuJobTbody) {
                    stuJobTbody.innerHTML = "";
                    db.students.forEach(student => {
                        const tr = document.createElement('tr');
                        
                        // 직업 선택 드롭다운 생성
                        let optionsHTML = `<option value="무직" ${student.job === '무직' || !student.job ? 'selected' : ''}>무직</option>`;
                        db.jobs.forEach(job => {
                            if (job.name !== '무직') {
                                optionsHTML += `<option value="${job.name}" ${student.job === job.name ? 'selected' : ''}>${job.name}</option>`;
                            }
                        });

                        tr.innerHTML = `
                            <td><strong>${student.name}</strong></td>
                            <td>
                                <select class="form-control" style="padding:6px; font-size:0.85rem; width: 120px;" id="st-job-${student.id}" onchange="handleStudentJobSelectChange('${student.id}')">
                                    ${optionsHTML}
                                </select>
                            </td>
                            <td>
                                <input type="text" class="form-control" style="padding:6px; font-size:0.85rem;" id="st-role-${student.id}" value="${student.role || ''}" placeholder="세부 역할 입력">
                            </td>
                            <td style="text-align: center;">
                                <input type="checkbox" id="st-handkerchief-${student.id}" ${student.isHandkerchiefManager ? 'checked' : ''} style="transform: scale(1.2); cursor: pointer;">
                            </td>
                            <td style="text-align: center;">
                                <input type="checkbox" id="st-meal-${student.id}" ${student.isMealManager ? 'checked' : ''} style="transform: scale(1.2); cursor: pointer;">
                            </td>
                            <td>
                                <input type="number" class="form-control" style="padding:6px; font-size:0.85rem; max-width:80px;" id="st-salary-${student.id}" value="${student.baseSalary !== undefined ? student.baseSalary : 50}">
                            </td>
                            <td>
                                <button class="btn btn-success" style="font-size:0.75rem; padding:6px 10px;" onclick="handleSaveStudentJob('${student.id}')">💾 저장</button>
                            </td>
                        `;
                        stuJobTbody.appendChild(tr);
                    });
                }
            } else if (activeSubTab === "system") {
                renderSystemTab();
            }
        }

        // 학생 직업 선택 변경 시 기본급 자동 기입
        function handleStudentJobSelectChange(studentId) {
            const db = getDB();
            const jobSelect = document.getElementById(`st-job-${studentId}`);
            const salaryInput = document.getElementById(`st-salary-${studentId}`);
            if (!jobSelect || !salaryInput) return;

            const selectedJob = jobSelect.value;
            const jobObj = db.jobs.find(j => j.name === selectedJob);
            const baseSalary = jobObj ? jobObj.baseSalary : 50;
            salaryInput.value = baseSalary;
        }

        // 학생 개별 직업/역할/기본급 설정 저장 (비동기 Firestore 연동)
        async function handleSaveStudentJob(studentId) {
            const db = getDB();
            const jobSelect = document.getElementById(`st-job-${studentId}`);
            const roleInput = document.getElementById(`st-role-${studentId}`);
            const salaryInput = document.getElementById(`st-salary-${studentId}`);
            const handCheckbox = document.getElementById(`st-handkerchief-${studentId}`);
            const mealCheckbox = document.getElementById(`st-meal-${studentId}`);

            if (!jobSelect || !roleInput || !salaryInput || !handCheckbox || !mealCheckbox) return;

            showSpinner("학생 직업 정보를 수정하는 중...");
            try {
                const jobVal = jobSelect.value;
                const roleVal = roleInput.value.trim();
                const salaryVal = parseInt(salaryInput.value) || 0;
                const isHand = handCheckbox.checked;
                const isMeal = mealCheckbox.checked;

                await fs.collection("users").doc(studentId).update({
                    job: jobVal,
                    role: roleVal,
                    baseSalary: salaryVal,
                    isHandkerchiefManager: isHand,
                    isMealManager: isMeal
                });

                showToast("학생의 직업 정보 및 권한이 클라우드에 성공적으로 저장되었습니다.", "success");
            } catch (err) {
                console.error("학생 직업 저장 실패:", err);
                alert("학생 직업 정보 처리에 실패했습니다. 보안 규칙을 확인하세요.");
            } finally {
                hideSpinner();
            }
        }

        // 초기화 처리들
        function resetSalaryHistories() {
            if (!confirm("⚠️ 정말로 당월 학생들의 월급 명세서 발행 이력을 삭제하시겠습니까? (이 작업은 복구할 수 없으며 학생의 잔액은 영향이 없습니다.)")) return;
            const db = getDB();
            db.salaryHistories = {};
            saveDB(db);
            showToast("💵 당월 월급 명세서 및 지급 기록이 완전히 초기화되었습니다.", "success");
            switchSubTab("reset");
        }

        function resetStudentBalances() {
            if (!confirm("⚠️ 정말로 학급 전체 학생들의 통장 잔액을 0 치킨으로 리셋하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
            const db = getDB();
            db.students.forEach(st => {
                st.balance = 0;
                db.transactions.push({
                    id: "tx_reset_bal_" + st.id + "_" + Date.now(),
                    studentId: st.id,
                    date: new Date().toISOString(),
                    description: "🔄 교사에 의한 통장 잔액 0 치킨 일괄 리셋 초기화",
                    type: "withdraw",
                    amount: 0,
                    balanceAfter: 0,
                    isSavingsMaturity: false
                });
            });
            saveDB(db);
            showToast("📉 모든 학생들의 지갑 잔액이 0 치킨으로 초기화되었습니다.", "warning");
            switchSubTab("reset");
        }

        function resetTransactions() {
            if (!confirm("⚠️ 정말로 학급 내 기록된 모든 예금, 출금 거래 장부 내역을 지우시겠습니까? 학생들의 잔액은 그대로 유지됩니다.")) return;
            const db = getDB();
            db.transactions = [];
            saveDB(db);
            showToast("📖 전체 거래 장부 내역이 완전히 영구 삭제되었습니다.", "danger");
            switchSubTab("reset");
        }

        function resetTaxData() {
            if (!confirm("⚠️ 정말로 학급의 세금 모금 내역과 장부를 초기화하시겠습니까?\n이 작업은 국고 세액을 0 치킨으로 완전 초기화하고 모든 세금 입출금 거래 및 목표물의 진행 상태를 리셋합니다.")) return;
            const db = getDB();
            db.tax = { totalTax: 0 };
            db.taxTransactions = [
                { id: "tax_reset_" + Date.now(), date: new Date().toISOString(), type: "deposit", amount: 0, description: "🏛️ 세금 내역 초기화 (0 치킨으로 재시작)" }
            ];
            if (db.taxGoals) {
                db.taxGoals.forEach(g => { g.current = 0; });
            }
            saveDB(db);
            showToast("🏛️ 국고 세금이 0 치킨으로 초기화되었습니다.", "success");
            switchSubTab("reset");
        }

        // 은행 내역 초기화 (예금/적금만, 통장 잔액 유지)
        function resetBankData() {
            if (!confirm("⚠️ 은행 내역을 초기화하시겠습니까?\n모든 학생의 자유 예금 잔고와 적금 가입 내역이 삭제됩니다. 통장 잔액은 유지됩니다.")) return;
            const db = getDB();
            db.savings = [];
            db.students.forEach(st => {
                st.freeDepositBalance = 0;
            });
            db.lastInterestPayDate = null;
            saveDB(db);
            showToast("🏦 은행 예금/적금 내역이 초기화되었습니다.", "success");
            loadTabData("manage");
        }

        // 상점 판매물품 초기화 (진열 상품 보호 - 인벤토리, 구매대장, 결제대기만 삭제)
        function resetShopData() {
            if (!confirm("⚠️ 학생의 상점 이용 데이터를 초기화하시겠습니까?\n교사가 등록해 둔 '진열 상품 목록'은 보호되며, 학생들의 인벤토리, 구매 대장 기록, 결제 대기 건만 삭제됩니다.")) return;
            const db = getDB();
            db.inventory = [];
            db.shopPurchaseLog = [];
            db.pendingPayments = [];
            db.useRequests = [];
            
            // 상점 진열 상품의 각 누적 판매 통계 카운터 0개로 리셋
            if (Array.isArray(db.shop)) {
                db.shop.forEach(p => {
                    p.purchaseCount = 0;
                });
            }

            saveDB(db);
            showToast("🛍️ 상점 학생 이용 데이터 및 판매 통계가 초기화되었습니다.", "success");
            loadTabData("manage");
        }

        // 상점 진열 상품 목록 초기화 (진열 상품만 삭제)
        function resetShopItemsOnly() {
            if (!confirm("⚠️ 상점 진열 상품 목록을 초기화하시겠습니까?\n교사가 등록했던 판매 상품들이 전부 삭제됩니다. (학생들의 인벤토리 및 기존 결제 완료 기록은 유지됩니다.)")) return;
            const db = getDB();
            db.shop = [];
            saveDB(db);
            showToast("🛍️ 상점 진열 상품 목록이 모두 삭제되었습니다.", "success");
            loadTabData("manage");
        }

        // 환경 내역 초기화 (활동 유형 목록, 보고서 제출 기록 삭제)
        function resetEnvData() {
            if (!confirm("⚠️ 환경 설정 및 보고서 데이터를 초기화하시겠습니까?\n활동 유형 목록과 보고서 제출 기록만 삭제되며 학생의 마일리지는 유지됩니다.")) return;
            const db = getDB();
            db.envActivityTypes = [];
            db.envReports = [];
            saveDB(db);
            showToast("🌿 환경 설정 및 보고서 기록이 초기화되었습니다.", "success");
            loadTabData("manage");
        }

        // 환경 마일리지 초기화 (학생 마일리지 및 누적합 0 연동 초기화)
        function resetEnvMileageData() {
            if (!confirm("⚠️ 환경 마일리지를 초기화하시겠습니까?\n모든 학생의 누적 마일리지와 잔여 마일리지가 0으로 리셋되며, 마일리지 적립 장부 및 일일 실천 정산 내역이 완전히 삭제됩니다.")) return;
            const db = getDB();
            db.envMileageLedger = [];
            db.monthlyAttendance = [];
            db.students.forEach(st => {
                st.mileage = 0;
                st.mileageBalance = 0;
            });
            saveDB(db);
            showToast("🌿 모든 학생의 환경 마일리지 및 관련 장부가 초기화되었습니다.", "success");
            loadTabData("manage");
        }

        function resetAllData() {
            if (!confirm("⚠️ [경고] 정말로 모든 데이터를 초기화하고 웹앱을 최초 설치 상태로 되돌리겠습니까?\n이 작업은 모든 학생 계정, 직업, 상점, 세금 장부를 포함한 데이터베이스 전체를 완전 삭제합니다.")) return;
            localStorage.removeItem('class_bank_db');
            showToast("⚙️ 데이터베이스를 삭제했습니다. 페이지를 새로고침하여 초기 상태로 재부팅합니다.", "success");
            setTimeout(() => {
                location.reload();
            }, 1000);
        }

        // 직업 저장
        async function handleSaveJob() {
            const name = document.getElementById('job-name-input').value.trim();
            const salary = parseInt(document.getElementById('job-salary-input').value);

            if (!name || isNaN(salary) || salary < 0) {
                showToast("올바른 직업명과 급여액을 지정해 주세요.", "danger");
                return;
            }

            const db = getDB();
            showSpinner("직업 정보를 저장하는 중...");

            try {
                if (editingOriginalJobName) {
                    // 수정 모드
                    const origName = editingOriginalJobName;
                    
                    // 중복 체크 (원래 이름과 다른 이름으로 바꿀 때만)
                    if (origName !== name) {
                        const isDup = db.jobs.some(j => j.name === name);
                        if (isDup) {
                            showToast("이미 존재하는 직업명입니다.", "danger");
                            hideSpinner();
                            return;
                        }

                        const batch = fs.batch();
                        // 기존 문서 삭제 후 새 문서 추가
                        batch.delete(fs.collection("jobs").doc(origName));
                        batch.set(fs.collection("jobs").doc(name), { name, baseSalary: salary });

                        // 해당 직업 가졌던 학생들 정보 업데이트
                        const studentsToUpdate = db.students.filter(st => st.job === origName);
                        studentsToUpdate.forEach(st => {
                            batch.update(fs.collection("users").doc(st.id), {
                                job: name,
                                baseSalary: salary
                            });
                        });

                        await batch.commit();
                        showToast(`💼 직업 정보가 수정되었습니다: ${origName} -> ${name} (${salary}치킨)`, "success");
                    } else {
                        // 직업명은 동일하고 급여만 수정
                        const batch = fs.batch();
                        batch.update(fs.collection("jobs").doc(name), { baseSalary: salary });

                        const studentsToUpdate = db.students.filter(st => st.job === name);
                        studentsToUpdate.forEach(st => {
                            batch.update(fs.collection("users").doc(st.id), {
                                baseSalary: salary
                            });
                        });

                        await batch.commit();
                        showToast(`💼 직업 급여 정보가 수정되었습니다: ${name} (${salary}치킨)`, "success");
                    }
                } else {
                    // 추가 모드
                    const jobIdx = db.jobs.findIndex(j => j.name === name);
                    if (jobIdx > -1) {
                        const batch = fs.batch();
                        batch.update(fs.collection("jobs").doc(name), { baseSalary: salary });

                        const studentsToUpdate = db.students.filter(st => st.job === name);
                        studentsToUpdate.forEach(st => {
                            batch.update(fs.collection("users").doc(st.id), {
                                baseSalary: salary
                            });
                        });

                        await batch.commit();
                        showToast(`💼 기존 직업의 기본급이 변경되었습니다: ${name} (${salary}치킨)`, "success");
                    } else {
                        await fs.collection("jobs").doc(name).set({ name, baseSalary: salary });
                        showToast(`💼 새 직업이 추가되었습니다: ${name} (${salary}치킨)`, "success");
                    }
                }

                handleResetJobForm();
            } catch (err) {
                console.error("직업 저장 실패:", err);
                alert("직업 정보 처리에 실패했습니다. 보안 규칙을 확인하세요.");
            } finally {
                hideSpinner();
            }
        }

        // 직업 수정 폼 바인딩
        function handleEditJob(name) {
            const db = getDB();
            const job = db.jobs.find(j => j.name === name);
            if (!job) return;

            document.getElementById('job-name-input').value = job.name;
            document.getElementById('job-salary-input').value = job.baseSalary;
            editingOriginalJobName = job.name;

            const btnReset = document.getElementById('btn-job-reset');
            if (btnReset) btnReset.style.display = "inline-flex";
        }

        // 직업 폼 초기화
        function handleResetJobForm() {
            document.getElementById('job-name-input').value = "";
            document.getElementById('job-salary-input').value = "";
            editingOriginalJobName = null;

            const btnReset = document.getElementById('btn-job-reset');
            if (btnReset) btnReset.style.display = "none";
        }

        // 직업 삭제
        async function handleDeleteJob(name) {
            const db = getDB();
            
            const hasStudent = db.students.some(s => s.job === name);
            if (hasStudent) {
                if (!confirm("현재 이 직업을 가진 학생이 있습니다. 그래도 삭제하시겠습니까?\n(삭제 시 해당 학생들의 직업은 초기화됩니다)")) return;
            } else {
                if (!confirm(`정말 '${name}' 직업을 삭제하시겠습니까?`)) return;
            }

            showSpinner("직업을 삭제하는 중...");

            try {
                const batch = fs.batch();
                batch.delete(fs.collection("jobs").doc(name));

                const noJobObj = db.jobs.find(j => j.name === "무직");
                const noJobSalary = noJobObj ? noJobObj.baseSalary : 50;

                const studentsToReset = db.students.filter(st => st.job === name);
                studentsToReset.forEach(st => {
                    batch.update(fs.collection("users").doc(st.id), {
                        job: "무직",
                        baseSalary: noJobSalary
                    });
                });

                await batch.commit();
                showToast(`직업 '${name}' 항목이 삭제되었으며, 해당 직업 학생들은 무직으로 연동되었습니다.`, "warning");
                
                if (editingOriginalJobName === name) {
                    handleResetJobForm();
                }
            } catch (err) {
                console.error("직업 삭제 실패:", err);
                alert("직업 정보 처리에 실패했습니다. 보안 규칙을 확인하세요.");
            } finally {
                hideSpinner();
            }
        }

        window.handleSaveJob = handleSaveJob;
        window.handleEditJob = handleEditJob;
        window.handleDeleteJob = handleDeleteJob;
        window.handleResetJobForm = handleResetJobForm;
        window.handleSaveStudentJob = handleSaveStudentJob;
        window.handleStudentJobSelectChange = handleStudentJobSelectChange;

        // 급여 대상에 따른 직업 기본급 로드
        function autoLoadStudentJobSalary() {
            const target = document.getElementById('salary-target-student').value;
            if (target === "all") {
                document.getElementById('salary-base-input').value = "";
                document.getElementById('salary-tax-input').value = "";
                document.getElementById('salary-job-select').value = "";
                autoCalcSalary();
                return;
            }

            const db = getDB();
            const student = db.students.find(s => s.id === target);
            if (student) {
                const jobName = student.job || "무직";
                document.getElementById('salary-job-select').value = jobName;
                
                // 학생 개별 지급 기본급이 있으면 그것을 쓰고, 없으면 직업 기본급, 그외엔 50 기본값
                const jobObj = db.jobs.find(j => j.name === jobName);
                const baseVal = student.baseSalary !== undefined ? student.baseSalary : (jobObj ? jobObj.baseSalary : 50);
                
                document.getElementById('salary-base-input').value = baseVal;
                autoCalcIncomeTax();
                autoCalcSalary();
            }
        }

        // 직업 드롭다운 선택 변경 시 기본급 로드
        function handleJobSelectChange() {
            const jobName = document.getElementById('salary-job-select').value;
            if (!jobName) return;
            const db = getDB();
            const jobObj = db.jobs.find(j => j.name === jobName);
            if (jobObj) {
                document.getElementById('salary-base-input').value = jobObj.baseSalary;
                autoCalcIncomeTax();
                autoCalcSalary();
            }
        }

        // 소득세 자동 계산
        function autoCalcIncomeTax() {
            const baseVal = parseInt(document.getElementById('salary-base-input').value) || 0;
            const tax = Math.round(baseVal * 0.1);
            document.getElementById('salary-tax-input').value = tax;
            autoCalcSalary();
        }

        // 실수령액 실시간 계산
        function autoCalcSalary() {
            const base = parseInt(document.getElementById('salary-base-input').value) || 0;
            const incomeTax = parseInt(document.getElementById('salary-tax-input').value) || 0;
            const health = parseInt(document.getElementById('salary-health-input').value) || 0;
            const electric = parseInt(document.getElementById('salary-electric-input').value) || 0;
            const meals = parseInt(document.getElementById('salary-meals-input').value) || 0;
            const rent = parseInt(document.getElementById('salary-rent-input').value) || 0;
            const deduct = parseInt(document.getElementById('salary-deduct-input').value) || 0;
            const bonus = parseInt(document.getElementById('salary-bonus-input').value) || 0;

            const netSalary = base - (incomeTax + health + electric + meals + rent + deduct) + bonus;
            const displayEl = document.getElementById('salary-net-display');
            if (displayEl) {
                displayEl.innerText = netSalary.toLocaleString();
            }
        }

        // 월급 수동 지급 실행 (비동기 Firestore 연동)
        async function handlePaySalarySubmit() {
            const target = document.getElementById('salary-target-student').value;
            const base = parseInt(document.getElementById('salary-base-input').value) || 0;
            const incomeTax = parseInt(document.getElementById('salary-tax-input').value) || 0;
            const health = parseInt(document.getElementById('salary-health-input').value) || 0;
            const electric = parseInt(document.getElementById('salary-electric-input').value) || 0;
            const meals = parseInt(document.getElementById('salary-meals-input').value) || 0;
            const rent = parseInt(document.getElementById('salary-rent-input').value) || 0;
            const deduct = parseInt(document.getElementById('salary-deduct-input').value) || 0;
            const bonus = parseInt(document.getElementById('salary-bonus-input').value) || 0;
            const comment = document.getElementById('salary-comment-input').value.trim();

            if (target !== "all" && base <= 0) {
                showToast("기본급 급여를 0보다 크게 설정해야 월급이 지급됩니다.", "danger");
                return;
            }

            const payBtn = document.getElementById('btn-pay-salary');
            if (payBtn) {
                payBtn.disabled = true;
                payBtn.innerText = "지급 처리 중...";
            }
            showSpinner("급여 정산 및 지급 이식 중...");

            try {
                const db = getDB();
                const batch = fs.batch();
                
                if (target === "all") {
                    let totalTaxCollected = 0;
                    let activeStudentsCount = 0;

                    for (const st of db.students) {
                        if (st.isFrozen) return;
                        
                        const jobName = st.job || "무직";
                        const jobObj = db.jobs.find(j => j.name === jobName);
                        const stBase = st.baseSalary !== undefined ? st.baseSalary : (jobObj ? jobObj.baseSalary : 50);
                        const stTax = Math.round(stBase * 0.1);
                        
                        const stNet = stBase - (stTax + health + electric + meals + rent + deduct) + bonus;
                        
                        // 학생 잔고 및 명세서 누적
                        const newBalance = (st.balance || 0) + stNet;
                        totalTaxCollected += stTax;
                        activeStudentsCount++;

                        const txId = "tx_sal_" + Date.now() + "_" + st.id;
                        const txRef = fs.collection("transactions").doc(txId);
                        batch.set(txRef, {
                            id: txId,
                            studentId: st.id,
                            date: new Date().toISOString(),
                            description: `💼 정기 학급 월급 지급 (실수령액: ${stNet} ${getCurrencyName()})`,
                            type: "deposit",
                            amount: stNet,
                            balanceAfter: newBalance,
                            isSavingsMaturity: false
                        });

                        const historyId = "sal_hist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                        const currentHistories = st.salaryHistories || [];
                        const updatedHistories = [...currentHistories, {
                            id: historyId,
                            txId: txId,
                            date: new Date().toISOString(),
                            base: stBase,
                            allowances: [
                                { name: "기본급", amount: stBase },
                                { name: "추가 수당(보너스)", amount: bonus }
                            ],
                            deductions: [
                                { name: "소득세 (10%)", amount: stTax },
                                { name: "건강보험료", amount: health },
                                { name: "공동 전기세", amount: electric },
                                { name: "학교 급식비", amount: meals },
                                { name: "책상 자리 임대료", amount: rent },
                                { name: "지각/행동 삭감액", amount: deduct }
                            ],
                            comment: comment || "이번 달도 학급을 위해 성실하게 수고해 주어 고맙습니다!",
                            netSalary: stNet
                        }];

                        const studentRef = fs.collection("users").doc(st.id);
                        batch.update(studentRef, {
                            balance: newBalance,
                            salaryHistories: updatedHistories
                        });
                    }

                    if (activeStudentsCount > 0) {
                        // 국고 세금 가산
                        const newTaxTotal = (db.tax.totalTax || 0) + totalTaxCollected;
                        const taxStateRef = fs.collection("tax").doc("state");
                        batch.set(taxStateRef, { totalTax: newTaxTotal }, { merge: true });

                        const taxTxId = "tax_sal_" + Date.now();
                        const taxTxRef = fs.collection("tax_transactions").doc(taxTxId);
                        batch.set(taxTxRef, {
                            id: taxTxId,
                            date: new Date().toISOString(),
                            type: "deposit",
                            amount: totalTaxCollected,
                            description: `월급 공제 세입 적립 (학급 전체 ${activeStudentsCount}명 일괄 공제 세금)`
                        });
                    }

                    await batch.commit();
                    showToast("📢 학급 전체 학생들에게 개별 직업 급여를 반영한 월급 지급 및 명세가 발행되었습니다.", "success");
                } else {
                    const st = db.students.find(s => s.id === target);
                    if (st) {
                        if (st.isFrozen) {
                            showToast("동결 상태인 학생에게는 월급을 지급할 수 없습니다.", "danger");
                            return;
                        }
                        const netSalary = base - (incomeTax + health + electric + meals + rent + deduct) + bonus;
                        const newBalance = (st.balance || 0) + netSalary;

                        const txId = "tx_sal_" + Date.now() + "_" + st.id;
                        const txRef = fs.collection("transactions").doc(txId);
                        batch.set(txRef, {
                            id: txId,
                            studentId: st.id,
                            date: new Date().toISOString(),
                            description: `💼 개별 월급 지급 (실수령액: ${netSalary} ${getCurrencyName()})`,
                            type: "deposit",
                            amount: netSalary,
                            balanceAfter: newBalance,
                            isSavingsMaturity: false
                        });

                        const historyId = "sal_hist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                        const currentHistories = st.salaryHistories || [];
                        const updatedHistories = [...currentHistories, {
                            id: historyId,
                            txId: txId,
                            date: new Date().toISOString(),
                            base: base,
                            allowances: [
                                { name: "기본급", amount: base },
                                { name: "추가 수당(보너스)", amount: bonus }
                            ],
                            deductions: [
                                { name: "소득세 (10%)", amount: incomeTax },
                                { name: "건강보험료", amount: health },
                                { name: "공동 전기세", amount: electric },
                                { name: "학교 급식비", amount: meals },
                                { name: "책상 자리 임대료", amount: rent },
                                { name: "지각/행동 삭감액", amount: deduct }
                            ],
                            comment: comment || "이번 달도 학급을 위해 성실하게 수고해 주어 고맙습니다!",
                            netSalary: netSalary
                        }];

                        const studentRef = fs.collection("users").doc(st.id);
                        batch.update(studentRef, {
                            balance: newBalance,
                            salaryHistories: updatedHistories
                        });

                        if (incomeTax > 0) {
                            const newTaxTotal = (db.tax.totalTax || 0) + incomeTax;
                            const taxStateRef = fs.collection("tax").doc("state");
                            batch.set(taxStateRef, { totalTax: newTaxTotal }, { merge: true });

                            const taxTxId = "tax_sal_" + Date.now();
                            const taxTxRef = fs.collection("tax_transactions").doc(taxTxId);
                            batch.set(taxTxRef, {
                                id: taxTxId,
                                date: new Date().toISOString(),
                                type: "deposit",
                                amount: incomeTax,
                                description: `월급 소득세 공제 세입 적립 (${st.name} 학생 급여 소득세 10%)`
                            });
                        }

                        await batch.commit();
                        showToast(`📢 ${st.name} 학생에게 월급 지급 완료!`, "success");
                    }
                }

                // 폼 필드 리셋
                document.getElementById('salary-comment-input').value = "";
                document.getElementById('salary-deduct-input').value = "0";
                document.getElementById('salary-bonus-input').value = "0";
            } catch (err) {
                console.error("월급 지급 중 오류 발생: ", err);
                alert("데이터베이스 저장에 실패했습니다. (에러: " + err.message + ")");
                showToast("급여 지급 처리에 실패했습니다.", "danger");
            } finally {
                hideSpinner();
                if (payBtn) {
                    payBtn.disabled = false;
                    payBtn.innerText = "📢 월급 최종 확정 및 지급";
                }
            }
        }

        // 특정 학생 거래내역 및 롤백 제어 패널 열기
        function handleViewStudentDetail(studentId) {
            const db = getDB();
            const student = db.students.find(s => s.id === studentId);
            if (!student) return;

            const panel = document.getElementById('teacher-student-detail-panel');
            panel.style.display = "block";
            document.getElementById('tsd-name-title').innerText = `👶 ${student.name} (${student.id}) 학생의 통장 거래 상세 내역`;

            const tbody = document.getElementById('tsd-transactions-tbody');
            tbody.innerHTML = "";

            const myTx = db.transactions.filter(tx => tx.studentId === studentId).sort((a,b) => new Date(b.date) - new Date(a.date));
            if (myTx.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">기록된 거래가 없습니다.</td></tr>`;
                return;
            }

            myTx.forEach(tx => {
                const tr = document.createElement('tr');
                const tDate = new Date(tx.date).toLocaleTimeString();
                tr.innerHTML = `
                    <td>${tDate}</td>
                    <td style="font-weight:bold; color:${tx.type === 'deposit' ? '#2b8a3e':'#e74c3c'};">${tx.type === 'deposit' ? '입금':'출금'}</td>
                    <td style="font-weight:bold;">${tx.amount.toLocaleString()} 치킨</td>
                    <td>${tx.description}</td>
                    <td>
                        <button class="btn btn-danger" style="font-size:0.7rem; padding:4px 8px;" onclick="handleRollbackTx('${tx.id}', '${studentId}')">↩️ 거래 롤백</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // 통합 거래 취소 및 롤백 공통 함수
        function undoTransaction(txId) {
            const db = getDB();
            const txIdx = db.transactions.findIndex(t => t.id === txId);
            if (txIdx === -1) {
                showToast("취소할 거래 내역을 찾을 수 없습니다.", "danger");
                return false;
            }

            const tx = db.transactions[txIdx];
            const studentId = tx.studentId;
            const student = db.students.find(s => s.id === studentId);
            if (!student) {
                showToast("해당 거래의 학생 계정을 찾을 수 없습니다.", "danger");
                return false;
            }

            const desc = tx.description || "";
            const isDeposit = (tx.type === "deposit");

            // 1. 기본 잔액 롤백
            if (isDeposit) {
                student.balance -= tx.amount;
            } else {
                student.balance += tx.amount;
            }

            // 2. 거래 종류별 세부 롤백 처리
            
            // A. 상점 상품 구매 롤백
            if (desc.includes("상품 구매")) {
                const vat = Math.round(tx.amount / 11);
                // 세금 국고 환원
                db.tax.totalTax = Math.max(0, db.tax.totalTax - vat);
                
                // 세금 장부에서 관련 부가세 세입 항목 제거
                db.taxTransactions = db.taxTransactions.filter(tt => 
                    !(tt.description.includes("부가세") && tt.description.includes(student.name))
                );

                // 상점 상품 구매 카운트 차감 및 인벤토리 회수
                // 상품명을 거래 설명에서 추출 (형식: "🛍️ 상품 구매: [상품명] (물품가 ... )")
                const matchName = desc.match(/🛍️ 상품 구매:\s*(.+?)\s*\(물품가/);
                if (matchName) {
                    const prodName = matchName[1].trim();
                    const prod = db.shop.find(p => p.name === prodName);
                    if (prod) {
                        prod.purchaseCount = Math.max(0, prod.purchaseCount - 1);
                        
                        // 인벤토리에서 차감
                        const invIdx = db.inventory.findIndex(inv => inv.studentId === studentId && inv.productId === prod.id);
                        if (invIdx > -1) {
                            db.inventory[invIdx].quantity -= 1;
                            db.inventory[invIdx].lastUpdated = new Date().toISOString();
                            if (db.inventory[invIdx].quantity <= 0) {
                                db.inventory.splice(invIdx, 1); // 0개가 되면 제거
                            }
                        }
                    }
                }
            }
            
            // B. 환경 실천 관련 롤백
            // B-1. 일일 환경 실천 보상 롤백 (출석)
            else if (desc.includes("일일 환경 실천 보상")) {
                // 당일 기록 monthlyAttendance에서 제거
                const txDateStr = new Date(tx.date).toISOString().split('T')[0];
                db.monthlyAttendance = db.monthlyAttendance.filter(att => 
                    !(att.studentId === studentId && att.date === txDateStr)
                );
            }
            // B-2. 환경 마일리지 획득 롤백 (인증샷)
            else if (desc.includes("환경 정화 실천 마일리지 획득")) {
                const matchMil = desc.match(/\+(\d+)점/);
                if (matchMil) {
                    const mileagePoints = parseInt(matchMil[1]);
                    student.mileage = Math.max(0, (student.mileage || 0) - mileagePoints);
                }
            }
            // B-3. 환경 마일리지 환전 롤백
            else if (desc.includes("환경 마일리지 환전")) {
                student.mileage = (student.mileage || 0) + 10;
            }

            // C. 월급 지급 롤백
            else if (desc.includes("월급 지급")) {
                // 세금 국고로 납부된 소득세 및 공제금액 환원
                const histories = db.salaryHistories[studentId];
                if (Array.isArray(histories)) {
                    const historyIdx = histories.findIndex(h => h.txId === txId);
                    if (historyIdx > -1) {
                        const history = histories[historyIdx];
                        let totalDeduct = 0;
                        if (Array.isArray(history.deductions)) {
                            history.deductions.forEach(d => {
                                totalDeduct += d.amount;
                            });
                        }
                        
                        db.tax.totalTax = Math.max(0, db.tax.totalTax - totalDeduct);
                        
                        // 세금 장부에서 해당 급여 공제 세입 거래를 역산하는 롤백 기록 추가
                        db.taxTransactions.push({
                            id: "tax_sal_roll_" + Date.now(),
                            date: new Date().toISOString(),
                            type: "withdraw",
                            amount: totalDeduct,
                            description: `↩️ 월급 회수로 인한 공제 세액 환원 (${student.name}: -${totalDeduct} 치킨)`
                        });

                        // 해당 명세서 히스토리 삭제
                        histories.splice(historyIdx, 1);
                    }
                }
            }

            // 3. 기존 거래를 지우고 롤백 기록 추가
            db.transactions.splice(txIdx, 1);
            db.transactions.push({
                id: "tx_roll_" + Date.now(),
                studentId: studentId,
                date: new Date().toISOString(),
                description: `↩️ 교사 거래 취소 롤백 반영 (${tx.description})`,
                type: isDeposit ? 'withdraw' : 'deposit',
                amount: tx.amount,
                balanceAfter: student.balance,
                isSavingsMaturity: false
            });

            saveDB(db);
            return true;
        }

        // 기존 상세조회 패널 롤백 래퍼
        function handleRollbackTx(txId, studentId) {
            if (confirm("↩️ 이 거래를 취소(롤백)하고 모든 연계 장부 데이터를 원상태로 복구하시겠습니까?")) {
                const success = undoTransaction(txId);
                if (success) {
                    showToast("↩️ 거래가 성공적으로 취소 및 롤백 복구되었습니다.", "success");
                    handleViewStudentDetail(studentId); // 패널 갱신
                    loadTabData("salary"); // 메인테이블 갱신
                }
            }
        }

        // 동결 처리
        function toggleStudentFreeze(studentId, isFrozen) {
            const db = getDB();
            const student = db.students.find(s => s.id === studentId);
            if (student) {
                student.isFrozen = isFrozen;
                saveDB(db);
                showToast(`🔒 ${student.name} 학생의 계정이 ${isFrozen ? '동결' : '해제'} 되었습니다.`, "warning");
                loadTabData("salary");
            }
        }

        // ==========================================
        // 4. TAB 2: BANK LOGIC (SAVINGS & DEPOSIT)
        // ==========================================
        let activeBankTab = "free";

        function switchBankTab(type) {
            activeBankTab = type;
            const btns = document.querySelectorAll('.bank-tab-btn');
            btns.forEach(btn => btn.classList.remove('active'));

            if (type === 'free') {
                btns[0].classList.add('active');
                document.getElementById('bank-free-panel').style.display = "block";
                document.getElementById('bank-saving-panel').style.display = "none";
            } else {
                btns[1].classList.add('active');
                document.getElementById('bank-free-panel').style.display = "none";
                document.getElementById('bank-saving-panel').style.display = "block";
            }
            renderBank();
        }

        function renderBank() {
            const db = getDB();
            const lockedMsg = document.getElementById('bank-locked-message');
            const activeContent = document.getElementById('bank-active-content');
            
            if (db.systemSettings && db.systemSettings.bankActive === false) {
                if (lockedMsg) lockedMsg.style.display = "block";
                if (activeContent) activeContent.style.display = "none";
                return;
            } else {
                if (lockedMsg) lockedMsg.style.display = "none";
                if (activeContent) activeContent.style.display = "block";
            }

            document.getElementById('free-rate-val').innerText = db.policies.freeRate.toFixed(1);
            document.getElementById('saving-rate-val').innerText = db.policies.savingRate.toFixed(1);
            document.getElementById('saving-term-val').innerText = db.policies.savingTerm;

            const student = db.students.find(s => s.id === currentUser.id);
            if (student) {
                const freeBalEl = document.getElementById('my-free-balance');
                if (freeBalEl) {
                    freeBalEl.innerText = (student.freeDepositBalance || 0).toLocaleString();
                }
            }

            if (activeBankTab === "saving") {
                renderMySavingsList(db);
            }
            
            renderMiniTransactions();
        }

        function renderMiniTransactions() {
            const db = getDB();
            const tbody = document.getElementById('student-bank-mini-tbody');
            if (!tbody) return;
            tbody.innerHTML = "";

            const myTx = db.transactions
                .filter(tx => tx.studentId === currentUser.id)
                .sort((a,b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5); 

            if (myTx.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); font-size:0.85rem;">거래 내역이 없습니다.</td></tr>`;
                return;
            }

            myTx.forEach(tx => {
                const tr = document.createElement('tr');
                if (tx.isSavingsMaturity) {
                    tr.classList.add('highlight-row');
                }

                const txDate = new Date(tx.date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const typeText = tx.type === "deposit" ? "📈 입금" : "📉 출금";
                const amountText = (tx.type === "deposit" ? "+" : "-") + tx.amount.toLocaleString();
                const amountColor = tx.type === "deposit" ? "#2ecc71" : "#e74c3c";

                tr.innerHTML = `
                    <td>${txDate}</td>
                    <td style="color: ${amountColor}; font-weight: bold; font-size: 0.85rem;">${typeText}</td>
                    <td style="color: ${amountColor}; font-weight: bold; font-size: 0.85rem;">${amountText}</td>
                    <td style="font-size: 0.85rem;">${tx.description}</td>
                    <td style="font-weight: bold; font-size: 0.85rem;">${tx.balanceAfter.toLocaleString()}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        function renderMySavingsList(db) {
            const listDiv = document.getElementById('my-savings-list');
            listDiv.innerHTML = "";

            const mySavings = db.savings.filter(s => s.studentId === currentUser.id && (s.type === "saving" || !s.type));
            if (mySavings.length === 0) {
                listDiv.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted);">현재 가입된 정기 적금 상품이 없습니다.</p>`;
                return;
            }

            mySavings.forEach(s => {
                const card = document.createElement('div');
                card.style.border = "1px solid var(--border-color)";
                card.style.borderRadius = "12px";
                card.style.padding = "12px";
                card.style.background = s.status === 'active' ? '#fff9db' : '#f8f9fa';

                const now = new Date();
                const end = new Date(s.endDate);
                
                let statusBadge = "";
                if (s.status === 'pending') {
                    statusBadge = `<span class="product-badge" style="background:#dee2e6; color:#495057;">가입 승인 대기중</span>`;
                } else if (s.status === 'active') {
                    const diffMs = end - now;
                    if (diffMs > 0) {
                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
                        let timeStr = "";
                        if (diffDays > 0) timeStr = `${diffDays}일 ${diffHours}시간 남음`;
                        else if (diffHours > 0) timeStr = `${diffHours}시간 ${diffMins}분 남음`;
                        else if (diffMins > 0) timeStr = `${diffMins}분 ${diffSecs}초 남음`;
                        else timeStr = `${diffSecs}초 남음`;
                        statusBadge = `<span class="product-badge" style="background:var(--warning); color:#d97706;">진행 중 (${timeStr})</span>`;
                    } else {
                        statusBadge = `<span class="product-badge" style="background:var(--primary); color:#d9480f;">만기 도달 (자동 이체중)</span>`;
                    }
                } else if (s.status === 'matured_pending') {
                    statusBadge = `<span class="product-badge" style="background:var(--primary); color:#d9480f;">만기 지급 처리중</span>`;
                } else {
                    statusBadge = `<span class="product-badge" style="background:#cbd5e1; color:#475569;">만기 이체 완료</span>`;
                }

                const interest = Math.round(s.principal * (s.interestRate / 100) * s.termMonths);
                const totalMaturity = s.principal + interest;

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                        <strong>🍗 원금: ${s.principal.toLocaleString()} ${getCurrencyName()}</strong>
                        ${statusBadge}
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-muted); line-height: 1.5;">
                        가입일: ${new Date(s.startDate).toLocaleString()}<br>
                        만기일: ${new Date(s.endDate).toLocaleString()}<br>
                        이자율: <span style="color:#d9480f; font-weight:bold;">월 ${s.interestRate}%</span><br>
                        예상 이자: <span style="color:#2ecc71; font-weight:bold;">+${interest.toLocaleString()} ${getCurrencyName()}</span> | 
                        <strong>만기 예상 수령액: <span style="color:#d9480f; font-weight:bold;">${totalMaturity.toLocaleString()} ${getCurrencyName()}</span></strong>
                    </div>
                `;
                listDiv.appendChild(card);
            });
        }

        async function handleDepositFree() {
            const amountInput = document.getElementById('free-amount');
            const amount = parseInt(amountInput.value);
            if (isNaN(amount) || amount <= 0) {
                showToast("올바른 입금 금액을 입력하세요.", "danger");
                return;
            }
            if (amount % 10 !== 0) {
                showToast(`자유 예금 입금 신청은 반드시 10단위 ${getCurrencyName()}이어야 합니다.`, "danger");
                return;
            }
            const db = getDB();
            const student = db.students.find(s => s.id === currentUser.id);
            if (student.balance < amount) {
                showToast("통장 잔액이 부족합니다.", "danger");
                return;
            }

            showSpinner("예금 입금 신청 처리 중...");
            try {
                const batch = fs.batch();
                
                const savingId = "free_" + Date.now();
                const savingRef = fs.collection("bank_savings").doc(savingId);
                batch.set(savingRef, {
                    id: savingId,
                    studentId: currentUser.id,
                    studentName: student.name,
                    type: "free",
                    principal: amount,
                    interestRate: db.policies.freeRate,
                    startDate: new Date().toISOString(),
                    status: "pending"
                });

                const txId = "tx_dep_pend_" + Date.now();
                const txRef = fs.collection("transactions").doc(txId);
                batch.set(txRef, {
                    id: txId,
                    studentId: currentUser.id,
                    date: new Date().toISOString(),
                    description: `⏳ 자유 예금 입금 신청 (교사 승인 대기중, 신청금액 ${amount}${getCurrencyName()})`,
                    type: "withdraw",
                    amount: amount,
                    balanceAfter: student.balance,
                    isSavingsMaturity: false
                });

                await batch.commit();
                showToast("⏳ 자유 예금 입금 신청이 완료되었습니다. 교사 승인 시 차감 및 입금됩니다.", "warning");
                amountInput.value = "";
            } catch (err) {
                console.error("예금 입금 에러: ", err);
                alert("데이터베이스 저장에 실패했습니다. (에러: " + err.message + ")");
                showToast("입금 신청에 실패했습니다.", "danger");
            } finally {
                hideSpinner();
            }
        }

        async function handleWithdrawFree() {
            const amountInput = document.getElementById('free-amount');
            const amount = parseInt(amountInput.value);
            if (isNaN(amount) || amount <= 0) {
                showToast("올바른 출금 금액을 입력하세요.", "danger");
                return;
            }
            const db = getDB();
            const student = db.students.find(s => s.id === currentUser.id);
            
            const freeBal = student.freeDepositBalance || 0;
            if (freeBal < amount) {
                showToast("자유 예금 잔액이 부족합니다.", "danger");
                return;
            }

            showSpinner("예금 출금 처리 중...");
            try {
                const batch = fs.batch();
                
                const nextFreeBal = freeBal - amount;
                const nextBalance = (student.balance || 0) + amount;
                
                const studentRef = fs.collection("users").doc(currentUser.id);
                batch.update(studentRef, {
                    freeDepositBalance: nextFreeBal,
                    balance: nextBalance
                });

                const txId = "tx_wdr_" + Date.now();
                const txRef = fs.collection("transactions").doc(txId);
                batch.set(txRef, {
                    id: txId,
                    studentId: currentUser.id,
                    date: new Date().toISOString(),
                    description: `🏦 자유 예금 출금 완료 (예금잔고 ➡️ 통장잔고 이체)`,
                    type: "deposit",
                    amount: amount,
                    balanceAfter: nextBalance,
                    isSavingsMaturity: false
                });

                await batch.commit();
                showToast("자유 예금 출금 완료", "success");
                amountInput.value = "";
            } catch (err) {
                console.error("예금 출금 에러: ", err);
                alert("데이터베이스 저장에 실패했습니다. (에러: " + err.message + ")");
                showToast("출금 처리에 실패했습니다.", "danger");
            } finally {
                hideSpinner();
            }
        }

        async function handleSubscribeSaving() {
            const amountInput = document.getElementById('saving-amount');
            const amount = parseInt(amountInput.value);
            
            if (isNaN(amount) || amount <= 0) {
                showToast("가입 금액을 입력해 주세요.", "danger");
                return;
            }

            const db = getDB();
            const student = db.students.find(s => s.id === currentUser.id);

            const minSaving = db.policies.minSavingAmount || 10;
            if (amount < minSaving) {
                showToast(`적금 최소 가입 금액은 ${minSaving} ${getCurrencyName()}입니다.`, "danger");
                return;
            }
            if (amount % 10 !== 0) {
                showToast(`적금 가입 금액은 10단위 ${getCurrencyName()}이어야 합니다.`, "danger");
                return;
            }

            if (student.balance < amount) {
                showToast("통장 잔액이 부족하여 적금에 가입할 수 없습니다.", "danger");
                return;
            }

            showSpinner("적금 가입 신청 중...");
            try {
                const batch = fs.batch();
                
                const savingId = "sav_" + Date.now();
                const savingRef = fs.collection("bank_savings").doc(savingId);
                batch.set(savingRef, {
                    id: savingId,
                    studentId: currentUser.id,
                    studentName: student.name,
                    type: "saving",
                    principal: amount,
                    interestRate: db.policies.savingRate,
                    termMonths: db.policies.savingTerm,
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + db.policies.savingTerm * 30 * 24 * 60 * 60 * 1000).toISOString(),
                    status: "pending"
                });

                const txId = "tx_sav_pend_" + Date.now();
                const txRef = fs.collection("transactions").doc(txId);
                batch.set(txRef, {
                    id: txId,
                    studentId: currentUser.id,
                    date: new Date().toISOString(),
                    description: `⏳ 정기 적금 가입 신청 (교사 승인 대기중, 가입 원금 ${amount}${getCurrencyName()})`,
                    type: "withdraw",
                    amount: amount,
                    balanceAfter: student.balance,
                    isSavingsMaturity: false
                });

                await batch.commit();
                amountInput.value = "";
                showToast("⏳ 적금 신청이 완료되었습니다. 교사의 승인 후 가입이 활성화되며 통장에서 원금이 차감됩니다.", "warning");
            } catch (err) {
                console.error("적금 가입 에러: ", err);
                alert("데이터베이스 저장에 실패했습니다. (에러: " + err.message + ")");
                showToast("적금 신청에 실패했습니다.", "danger");
            } finally {
                hideSpinner();
            }
        }

        // 실시간 시간 흘러가는 렌더러 (Cron 비활성화 후 화면 렌더링용)
        function updateSavingsTimeRemaining() {
            if (!currentUser) return;
            // 만기 적금 자동 이체 스케줄러 (1초마다 체크)
            checkAndProcessMaturedSavings();
            const db = getDB();
            if (currentUser.role === "student" && activeTab === "bank" && activeBankTab === "saving") {
                renderMySavingsList(db);
            } else if (currentUser.role === "teacher" && activeTab === "bank") {
                renderTeacherBankTab(db);
            }
        }

        // 자유 예금 월 이자 자동 정산 및 적금 상태 체크
        function monthlyInterest() {
            const db = getDB();
            const now = new Date();
            
            if (!db.lastInterestPayDate) {
                db.lastInterestPayDate = now.toISOString();
                saveDB(db);
                return;
            }

            const lastPay = new Date(db.lastInterestPayDate);
            const diffMs = now - lastPay;
            
            // 30일을 1개월로 간주하여 이자 지급 (실제 운영 시 30일 = 30 * 24 * 60 * 60 * 1000 ms)
            const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
            const elapsedMonths = Math.floor(diffMs / oneMonthMs);

            if (elapsedMonths > 0) {
                let anyInterestPaid = false;
                
                db.students.forEach(st => {
                    if (st.isFrozen) return;
                    
                    const monthlyRate = (db.policies.freeRate / 100);
                    const freeBal = st.freeDepositBalance || 0;
                    const interest = Math.round(freeBal * monthlyRate * elapsedMonths);
                    
                    if (interest > 0) {
                        st.balance += interest;
                        db.transactions.push({
                            id: "tx_interest_" + Date.now() + "_" + st.id,
                            studentId: st.id,
                            date: now.toISOString(),
                            description: `🏦 자유 예금 월 이자 지급 (${elapsedMonths}개월분 정산, 월 ${db.policies.freeRate}% 기준)`,
                            type: "deposit",
                            amount: interest,
                            balanceAfter: st.balance,
                            isSavingsMaturity: false
                        });
                        anyInterestPaid = true;
                    }
                });

                const nextPayDate = new Date(lastPay.getTime() + elapsedMonths * oneMonthMs);
                db.lastInterestPayDate = nextPayDate.toISOString();
                saveDB(db);
                
                if (anyInterestPaid) {
                    showToast(`🏦 자유 예금 ${elapsedMonths}개월분 이자가 일괄 정산 및 지급되었습니다.`, "success");
                    const activeNav = document.querySelector('.nav-item.active');
                    if (activeNav && currentUser) {
                        const tabId = activeNav.id.replace('nav-', '');
                        loadTabData(tabId);
                    }
                }
            }
        }

        // --- 교사용 은행 탭 렌더링 ---
        function renderTeacherBankTab(db) {
            if (document.getElementById('policy-free-rate')) {
                document.getElementById('policy-free-rate').value = db.policies.freeRate;
                document.getElementById('policy-saving-rate').value = db.policies.savingRate;
                document.getElementById('policy-saving-term').value = db.policies.savingTerm;
                document.getElementById('policy-min-saving-amount').value = db.policies.minSavingAmount || 10;
            }

            // 가입 대기 예금/적금
            const pendingTbody = document.getElementById('teacher-savings-pending-tbody');
            pendingTbody.innerHTML = "";
            const pendings = db.savings.filter(s => s.status === 'pending');

            if (pendings.length === 0) {
                pendingTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">신청 내역이 없습니다.</td></tr>`;
            } else {
                pendings.forEach(s => {
                    const isFree = s.type === "free";
                    const typeBadge = isFree ? `<span class="product-badge free" style="background:#e3fafc; color:#0b7285;">자유 예금</span>` : `<span class="product-badge saving" style="background:#fff3bf; color:#d9480f;">정기 적금</span>`;
                    const interest = isFree ? "-" : `+${Math.round(s.principal * (s.interestRate / 100) * s.termMonths)} ${getCurrencyName()}`;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${s.studentName || s.studentId}</strong></td>
                        <td>${typeBadge}</td>
                        <td>${s.principal} ${getCurrencyName()}</td>
                        <td>${interest}</td>
                        <td>
                            <button class="btn btn-success" style="font-size:0.7rem; padding:4px 8px;" onclick="handleApproveSaving('${s.id}', true)">승인</button>
                            <button class="btn btn-danger" style="font-size:0.7rem; padding:4px 8px;" onclick="handleApproveSaving('${s.id}', false)">반려</button>
                        </td>
                    `;
                    pendingTbody.appendChild(tr);
                });
            }

            // 만기 도달 적금 수동 지급용 (스케줄러가 오작동하거나 즉각 수동 처리 시 필요)
            const maturedTbody = document.getElementById('teacher-savings-matured-tbody');
            maturedTbody.innerHTML = "";
            
            const now = new Date();
            const maturedSavings = db.savings.filter(s => (s.type === "saving" || !s.type) && s.status === 'active' && now >= new Date(s.endDate));

            if (maturedSavings.length === 0) {
                maturedTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">현재 지급 대상 만기 적금이 없습니다.</td></tr>`;
            } else {
                maturedSavings.forEach(s => {
                    const interest = Math.round(s.principal * (s.interestRate / 100) * s.termMonths);
                    const payout = s.principal + interest;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${s.studentName || s.studentId}</strong></td>
                        <td>${new Date(s.startDate).toLocaleString()}</td>
                        <td>${new Date(s.endDate).toLocaleString()}</td>
                        <td>${s.principal} ${getCurrencyName()}</td>
                        <td>${interest} ${getCurrencyName()}</td>
                        <td style="font-weight:bold; color:#d9480f;">${payout} ${getCurrencyName()}</td>
                        <td>
                            <button class="btn btn-success" style="font-size:0.75rem; padding:6px 12px;" onclick="handlePayMaturedSaving('${s.id}')">🍗 만기금 즉시 지급</button>
                        </td>
                    `;
                    maturedTbody.appendChild(tr);
                });
            }

            // 전체 학생 적금 현황 대시보드 렌더링
            const dashTbody = document.getElementById('teacher-savings-dashboard-tbody');
            if (dashTbody) {
                dashTbody.innerHTML = "";
                
                // 적금만 대시보드에 렌더링
                const savingsOnly = db.savings.filter(s => s.type === "saving" || !s.type);
                if (savingsOnly.length === 0) {
                    dashTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">기록된 적금 내역이 없습니다.</td></tr>`;
                } else {
                    const sortedSavings = [...savingsOnly].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
                    sortedSavings.forEach(s => {
                        const tr = document.createElement('tr');
                        const isMatured = now >= new Date(s.endDate);
                        
                        let statusText = "";
                        let actionHTML = "";
                        
                        if (s.status === 'pending') {
                            statusText = `<span class="product-badge" style="background:#dee2e6; color:#495057;">가입 승인 대기중</span>`;
                            actionHTML = `
                                <button class="btn btn-success" style="font-size:0.65rem; padding:2px 6px;" onclick="handleApproveSaving('${s.id}', true)">승인</button>
                                <button class="btn btn-danger" style="font-size:0.65rem; padding:2px 6px;" onclick="handleApproveSaving('${s.id}', false)">반려</button>
                            `;
                        } else if (s.status === 'active') {
                            const diffMs = new Date(s.endDate) - now;
                            if (diffMs > 0) {
                                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                                const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
                                let timeStr = "";
                                if (diffDays > 0) timeStr = `${diffDays}일 ${diffHours}시간 남음`;
                                else if (diffHours > 0) timeStr = `${diffHours}시간 ${diffMins}분 남음`;
                                else if (diffMins > 0) timeStr = `${diffMins}분 ${diffSecs}초 남음`;
                                else timeStr = `${diffSecs}초 남음`;
                                statusText = `<span class="product-badge" style="background:var(--warning); color:#d97706;">진행 중 (${timeStr})</span>`;
                                actionHTML = `<span style="font-size:0.75rem; color:var(--text-muted);">진행중</span>`;
                            } else {
                                statusText = `<span class="product-badge" style="background:var(--primary); color:#d9480f;">만기 도달 (자동 이체중)</span>`;
                                actionHTML = `
                                    <button class="btn btn-success" style="font-size:0.65rem; padding:4px 8px; font-weight:bold;" onclick="handlePayMaturedSaving('${s.id}')">🍗 만기금 지급</button>
                                `;
                            }
                        } else if (s.status === 'completed' || s.status === 'matured') {
                            statusText = `<span class="product-badge" style="background:#cbd5e1; color:#475569;">만기 이체 완료</span>`;
                            actionHTML = `<span style="font-size:0.75rem; color:#2b8a3e; font-weight:bold;">지급 완료</span>`;
                        }
                        
                        const endDateStr = s.status === 'pending' ? '승인 시 결정' : new Date(s.endDate).toLocaleString();
                        
                        tr.innerHTML = `
                            <td><strong>${s.studentName || s.studentId}</strong></td>
                            <td>${s.principal.toLocaleString()} ${getCurrencyName()}</td>
                            <td>월 ${s.interestRate}%</td>
                            <td>${s.termMonths}개월</td>
                            <td><span style="font-size:0.8rem; color:#868e96;">${endDateStr}</span></td>
                            <td>${statusText}</td>
                            <td>${actionHTML}</td>
                        `;
                        dashTbody.appendChild(tr);
                    });
                }
            }

            // 자유 예금 가입 현황 대시보드 렌더링
            const freeTbody = document.getElementById('teacher-free-deposit-tbody');
            if (freeTbody) {
                freeTbody.innerHTML = '';
                const freeSavings = db.savings.filter(s => s.type === 'free');
                if (freeSavings.length === 0) {
                    freeTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">자유 예금 가입 학생이 없습니다.</td></tr>`;
                } else {
                    freeSavings.forEach(s => {
                        const tr = document.createElement('tr');
                        let statusBadge = '';
                        if (s.status === 'pending') statusBadge = `<span class="product-badge" style="background:#dee2e6; color:#495057;">승인 대기</span>`;
                        else if (s.status === 'active') statusBadge = `<span class="product-badge" style="background:#e3fafc; color:#0b7285;">운용중</span>`;
                        else statusBadge = `<span class="product-badge" style="background:#cbd5e1; color:#475569;">종료</span>`;
                        const startStr = s.startDate ? new Date(s.startDate).toLocaleDateString('ko-KR') : '-';
                        tr.innerHTML = `
                            <td><strong>${s.studentName || s.studentId}</strong> <span style="font-size:0.78rem; color:var(--text-muted);">(${s.studentId})</span></td>
                            <td>${statusBadge}</td>
                            <td style="font-weight:bold; color:#0b7285;">${(s.principal || 0).toLocaleString()} ${getCurrencyName()}</td>
                            <td style="font-size:0.85rem; color:var(--text-muted);">${startStr}</td>
                        `;
                        freeTbody.appendChild(tr);
                    });
                }
            }
        }

        // 예금 및 적금 가입 신청 승인/반려 (실제 차감이 승인 시점에 이루어짐)
        async function handleApproveSaving(savingId, isApprove) {
            const db = getDB();
            const saving = db.savings.find(s => s.id === savingId);
            if (!saving) return;

            const student = db.students.find(st => st.id === saving.studentId);
            if (!student) return;

            showSpinner("가입 신청 승인 처리 중입니다...");

            try {
                if (isApprove) {
                    if (student.balance < saving.principal) {
                        showToast("통장 잔고가 부족하여 승인할 수 없습니다.", "danger");
                        return;
                    }

                    await fs.runTransaction(async (transaction) => {
                        const savingRef = fs.collection("bank_savings").doc(savingId);
                        const studentRef = fs.collection("users").doc(saving.studentId);

                        const savingDoc = await transaction.get(savingRef);
                        const studentDoc = await transaction.get(studentRef);

                        if (!savingDoc.exists || savingDoc.data().status !== "pending") {
                            throw new Error("이미 처리된 신청서입니다.");
                        }

                        const currentStudentBalance = studentDoc.exists ? (studentDoc.data().balance || 0) : 0;
                        if (currentStudentBalance < saving.principal) {
                            throw new Error("잔액이 부족합니다.");
                        }

                        // 1. 학생 잔고 차감
                        const newBalance = currentStudentBalance - saving.principal;
                        const updateData = { balance: newBalance };

                        if (saving.type === "free") {
                            const currentFreeDeposit = studentDoc.exists ? (studentDoc.data().freeDepositBalance || 0) : 0;
                            updateData.freeDepositBalance = currentFreeDeposit + saving.principal;
                            transaction.update(studentRef, updateData);

                            transaction.update(savingRef, { status: "completed" });

                            const txId = "tx_dep_act_" + Date.now();
                            const txRef = fs.collection("transactions").doc(txId);
                            transaction.set(txRef, {
                                id: txId,
                                studentId: saving.studentId,
                                date: new Date().toISOString(),
                                description: `🏦 자유 예금 입금 최종 승인 완료 (원금 ${saving.principal}${getCurrencyName()} 저축)`,
                                type: "withdraw",
                                amount: saving.principal,
                                balanceAfter: newBalance,
                                isSavingsMaturity: false
                            });
                        } else {
                            transaction.update(studentRef, updateData);

                            const end = new Date();
                            end.setMonth(end.getMonth() + saving.termMonths);
                            transaction.update(savingRef, {
                                status: "active",
                                startDate: new Date().toISOString(),
                                endDate: end.toISOString()
                            });

                            const txId = "tx_sav_act_" + Date.now();
                            const txRef = fs.collection("transactions").doc(txId);
                            transaction.set(txRef, {
                                id: txId,
                                studentId: saving.studentId,
                                date: new Date().toISOString(),
                                description: `⏳ 정기 적금 가입 최종 승인 완료 (원금 ${saving.principal}${getCurrencyName()} 차감, 이율: 월 ${saving.interestRate}%)`,
                                type: "withdraw",
                                amount: saving.principal,
                                balanceAfter: newBalance,
                                isSavingsMaturity: false
                            });
                        }
                    });

                    if (saving.type === "free") {
                        showToast("자유 예금 입금 신청이 승인되어 예금에 저축되었습니다.", "success");
                    } else {
                        showToast("정기 적금 가입이 최종 승인되었습니다.", "success");
                    }
                } else {
                    // 반려 처리
                    await fs.runTransaction(async (transaction) => {
                        const savingRef = fs.collection("bank_savings").doc(savingId);
                        const studentRef = fs.collection("users").doc(saving.studentId);
                        
                        const savingDoc = await transaction.get(savingRef);
                        const studentDoc = await transaction.get(studentRef);

                        if (!savingDoc.exists || savingDoc.data().status !== "pending") {
                            throw new Error("이미 처리된 신청서입니다.");
                        }

                        const currentStudentBalance = studentDoc.exists ? (studentDoc.data().balance || 0) : 0;

                        transaction.delete(savingRef);

                        const txId = "tx_sav_rej_etc_" + Date.now();
                        const txRef = fs.collection("transactions").doc(txId);
                        
                        const descText = saving.type === "free" 
                            ? `❌ 자유 예금 입금 신청 반려 (신청액 ${saving.principal}${getCurrencyName()} 반려)`
                            : `❌ 정기 적금 가입 신청 반려`;

                        transaction.set(txRef, {
                            id: txId,
                            studentId: saving.studentId,
                            date: new Date().toISOString(),
                            description: descText,
                            type: "withdraw",
                            amount: 0,
                            balanceAfter: currentStudentBalance,
                            isSavingsMaturity: false
                        });
                    });

                    if (saving.type === "free") {
                        showToast("자유 예금 입금 신청을 반려했습니다.", "warning");
                    } else {
                        showToast("정기 적금 가입 신청을 반려했습니다.", "warning");
                    }
                }
            } catch (error) {
                console.error("Error approving saving: ", error);
                showToast("🚫 승인 처리 중 오류가 발생했습니다: " + error.message, "danger");
            } finally {
                hideSpinner();
            }
        }

        // 만기 적금 수동 지급 완료 (스케줄러 보조용)
        async function handlePayMaturedSaving(savingId) {
            const db = getDB();
            const saving = db.savings.find(s => s.id === savingId);
            if (!saving) return;

            const student = db.students.find(st => st.id === saving.studentId);
            if (!student) return;

            showSpinner("만기 적금 수동 지급 처리 중입니다...");

            try {
                const interest = Math.round(saving.principal * (saving.interestRate / 100) * saving.termMonths);
                const totalPayout = saving.principal + interest;

                await fs.runTransaction(async (transaction) => {
                    const savingRef = fs.collection("bank_savings").doc(savingId);
                    const studentRef = fs.collection("users").doc(saving.studentId);

                    const savingDoc = await transaction.get(savingRef);
                    const studentDoc = await transaction.get(studentRef);

                    if (!savingDoc.exists || savingDoc.data().status !== "active") {
                        throw new Error("활성화 상태가 아니거나 이미 해지된 적금입니다.");
                    }

                    const currentBalance = studentDoc.exists ? (studentDoc.data().balance || 0) : 0;
                    const newBalance = currentBalance + totalPayout;

                    // 1. 학생 잔고 지급
                    transaction.update(studentRef, { balance: newBalance });

                    // 2. 적금 완료 처리
                    transaction.update(savingRef, { 
                        status: "completed",
                        payoutDate: new Date().toISOString(),
                        payoutAmount: totalPayout
                    });

                    // 3. 거래 내역 기재
                    const txId = "tx_mat_payout_" + Date.now();
                    const txRef = fs.collection("transactions").doc(txId);
                    transaction.set(txRef, {
                        id: txId,
                        studentId: student.id,
                        date: new Date().toISOString(),
                        description: `🎉 적금 만기 원금+이자 수령 (원금 ${saving.principal} + 이자 ${interest})`,
                        type: "deposit",
                        amount: totalPayout,
                        balanceAfter: newBalance,
                        isSavingsMaturity: true
                    });
                });

                showToast(`${student.name} 학생에게 적금 만기금 ${totalPayout} ${getCurrencyName()}을 지급 완료하였습니다!`, "success");
            } catch (error) {
                console.error("Error manual matured payout: ", error);
                showToast("🚫 만기금 지급 중 오류가 발생했습니다: " + error.message, "danger");
            } finally {
                hideSpinner();
            }
        }

        // 적금 만기 자동 이체 스케줄러 함수 (1초마다 호출)
        async function checkAndProcessMaturedSavings() {
            const db = getDB();
            const now = new Date();
            
            // 만기된 적금들 필터링
            const maturedSavings = db.savings.filter(s => 
                (s.type === "saving" || !s.type) && 
                s.status === "active" && 
                now >= new Date(s.endDate)
            );

            for (const s of maturedSavings) {
                try {
                    // 트랜잭션 실행으로 중복 지급 방지
                    await fs.runTransaction(async (transaction) => {
                        const savingRef = fs.collection("bank_savings").doc(s.id);
                        const studentRef = fs.collection("users").doc(s.studentId);
                        
                        const savingDoc = await transaction.get(savingRef);
                        const studentDoc = await transaction.get(studentRef);
                        
                        if (!savingDoc.exists || !studentDoc.exists) return;
                        
                        const savingData = savingDoc.data();
                        const studentData = studentDoc.data();
                        
                        // 이미 다른 기기에 의해 만기 처리되었거나 활성 상태가 아니면 패스
                        if (savingData.status !== "active") return;
                        
                        const interest = Math.round(savingData.principal * (savingData.interestRate / 100) * savingData.termMonths);
                        const totalPayout = savingData.principal + interest;
                        
                        const newBalance = (studentData.balance || 0) + totalPayout;
                        
                        // 학생 잔액 업데이트
                        transaction.update(studentRef, { balance: newBalance });
                        
                        // 적금 상태 업데이트
                        transaction.update(savingRef, {
                            status: "completed",
                            payoutDate: now.toISOString(),
                            payoutAmount: totalPayout
                        });
                        
                        // 거래 내역 추가
                        const txId = "tx_sav_auto_mat_" + Date.now() + "_" + s.studentId;
                        const txRef = fs.collection("transactions").doc(txId);
                        transaction.set(txRef, {
                            id: txId,
                            studentId: s.studentId,
                            date: now.toISOString(),
                            description: `📈 정기 적금 만기 자동 이체 (원금 ${savingData.principal.toLocaleString()} + 이자 ${interest.toLocaleString()} 수령)`,
                            type: "deposit",
                            amount: totalPayout,
                            balanceAfter: newBalance,
                            isSavingsMaturity: true
                        });
                        
                        if (currentUser && currentUser.id === s.studentId) {
                            showToast(`🎉 정기 적금이 만기되어 원금+이자 총 ${totalPayout} ${getCurrencyName()}이 자동 이체되었습니다!`, "success");
                        }
                    });
                } catch (err) {
                    console.error("적금 자동 만기 처리 실패: ", err);
                }
            }
        }

        // 금융 및 정책 변경
        function saveBankPolicies() {
            const freeRate = parseFloat(document.getElementById('policy-free-rate').value);
            const savingRate = parseFloat(document.getElementById('policy-saving-rate').value);
            const savingTerm = parseInt(document.getElementById('policy-saving-term').value);
            const minSavingAmount = parseInt(document.getElementById('policy-min-saving-amount').value);

            if (isNaN(freeRate) || isNaN(savingRate) || isNaN(savingTerm) || isNaN(minSavingAmount)) {
                showToast("모든 값을 올바른 숫자로 입력해 주세요.", "danger");
                return;
            }

            const db = getDB();
            db.policies.freeRate = freeRate;
            db.policies.savingRate = savingRate;
            db.policies.savingTerm = savingTerm;
            db.policies.minSavingAmount = minSavingAmount;

            saveDB(db);
            showToast("⚙️ 학급은행 금융 정책이 일괄 변경 반영되었습니다.", "success");
            loadTabData("bank");
        }

        // ==========================================
        // 5. TAB 3: SHOP LOGIC
        // ==========================================
        // 5. TAB 3: SHOP LOGIC (쌀알마켓)
        // ==========================================
        let currentSelectedItemId = null;
        let editingShopItemId = null;

        function renderShop() {
            const db = getDB();
            const lockedMsg = document.getElementById('shop-locked-message');
            const activeContent = document.getElementById('shop-active-content');
            
            if (db.systemSettings && db.systemSettings.shopActive === false) {
                if (lockedMsg) lockedMsg.style.display = "block";
                if (activeContent) activeContent.style.display = "none";
                return;
            } else {
                if (lockedMsg) lockedMsg.style.display = "none";
                if (activeContent) activeContent.style.display = "block";
            }

            if (db.systemSettings) {
                const hoursEl = document.getElementById('shop-hours-display');
                const noticeEl = document.getElementById('shop-notice-display');
                if (hoursEl) hoursEl.innerText = db.systemSettings.shopHours || "평일 09:00 ~ 16:00";
                if (noticeEl) noticeEl.innerText = db.systemSettings.shopNotice || "주의: 상품 구매 후 취소 및 환불은 선생님께 직접 요청해야 합니다.";
            }

            const container = document.getElementById('shop-items-container');
            container.innerHTML = "";

            const banner = document.getElementById('news-flash-banner');
            if (db.newsFlash) {
                banner.style.display = "flex";
                document.getElementById('news-flash-text').innerText = db.newsFlash.message;
            } else {
                banner.style.display = "none";
            }

            document.getElementById('approval-limit-display').innerText = db.policies.approvalLimit;

            db.shop.forEach(item => {
                // 인플레이션 가격 계산 (basePrice가 VAT포함 최종가)
                let finalPrice = item.basePrice;
                if (item.weeklyGoal !== -1 && item.purchaseCount > item.weeklyGoal) {
                    const excess = item.purchaseCount - item.weeklyGoal;
                    finalPrice = Math.round(item.basePrice * (1 + excess * 0.1));
                }
                if (db.newsFlash && db.newsFlash.category === item.category) {
                    finalPrice = Math.round(finalPrice * (1 + db.newsFlash.rate / 100));
                }
                item.price = finalPrice;

                // VAT Inclusive: 표시가 = finalPrice (이미 VAT포함), 내부 VAT 분리만
                const vatIncluded = Math.floor(finalPrice * 10 / 110);

                const card = document.createElement('div');
                card.className = "shop-item-card";

                const isInflation = item.weeklyGoal !== -1 && item.purchaseCount > item.weeklyGoal;
                const demandBadge = isInflation 
                    ? `<span class="demand-badge">📈 인기 (+${((item.purchaseCount - item.weeklyGoal)*10).toFixed(0)}%)</span>` 
                    : "";

                const icon = item.emoji || (item.category === 'coupon' ? '🎫' : '🍪');
                const catText = item.category === 'coupon' ? '학급 권리' : '간식 매점';

                card.innerHTML = `
                    ${demandBadge}
                    <div class="shop-item-icon">${icon}</div>
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-cat">${catText}</div>
                    <div class="price-display">${finalPrice.toLocaleString()} ${getCurrencyName()}</div>
                    <span class="price-vat-info" style="font-size:0.78rem; color:var(--text-muted);">※ VAT 포함가 (내부 부가세: ${vatIncluded}${getCurrencyName()})</span>
                    <button class="btn btn-primary" onclick="handleBuyRequest('${item.id}')" style="width: 100%; justify-content: center; margin-top: 10px; font-weight: bold;">구매 신청</button>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">
                        목표량: ${item.weeklyGoal === -1 ? '제한 없음' : item.weeklyGoal + '회'} / 실구매: ${item.purchaseCount}회
                    </div>
                `;
                container.appendChild(card);
            });

            // 학생용 내 가방(인벤토리) 연동 렌더링
            renderMyInventory(db);
        }

        function handleBuyRequest(productId) {
            const db = getDB();
            const item = db.shop.find(p => p.id === productId);
            if (!item) return;

            currentSelectedItemId = productId;

            let finalPrice = item.basePrice;
            if (item.weeklyGoal !== -1 && item.purchaseCount > item.weeklyGoal) {
                const excess = item.purchaseCount - item.weeklyGoal;
                finalPrice = Math.round(item.basePrice * (1 + excess * 0.1));
            }
            if (db.newsFlash && db.newsFlash.category === item.category) {
                finalPrice = Math.round(finalPrice * (1 + db.newsFlash.rate / 100));
            }

            const totalCost = finalPrice;
            const vat = Math.round(totalCost * 0.1);

            document.getElementById('modal-item-title').innerText = item.category === 'coupon' ? "🎫 권리 상세 내용" : "🍗 간식 상세 내용";
            document.getElementById('modal-item-emoji').innerText = item.emoji || (item.category === 'coupon' ? '🎫' : '🍪');
            document.getElementById('modal-item-name').innerText = item.name;
            document.getElementById('modal-item-desc').innerText = item.description || "상세 설명이 비어있습니다.";
            document.getElementById('modal-item-price').innerText = `${totalCost.toLocaleString()} ${getCurrencyName()}`;

            document.getElementById('shop-detail-modal').style.display = "flex";
        }

        function closeShopDetailModal() {
            document.getElementById('shop-detail-modal').style.display = "none";
            currentSelectedItemId = null;
        }

        async function handleConfirmPurchase() {
            if (!currentSelectedItemId) return;
            const productId = currentSelectedItemId;
            closeShopDetailModal();
            await handleBuyItem(productId);
        }

        async function handleBuyItem(productId) {
            const db = getDB();
            const item = db.shop.find(p => p.id === productId);
            const student = db.students.find(s => s.id === currentUser.id);

            // ── 인플레이션 가격 계산 ──
            let finalPrice = item.basePrice;
            if (item.weeklyGoal !== -1 && item.purchaseCount > item.weeklyGoal) {
                const excess = item.purchaseCount - item.weeklyGoal;
                finalPrice = Math.round(item.basePrice * (1 + excess * 0.1));
            }
            if (db.newsFlash && db.newsFlash.category === item.category) {
                finalPrice = Math.round(finalPrice * (1 + db.newsFlash.rate / 100));
            }

            // ── 부가세 Inclusive 처리 (가격 안에 VAT 10% 포함) ──
            const totalCost = finalPrice;
            const vat = Math.round(totalCost * 0.1);
            const netPrice = totalCost - vat;

            // ── 잔액 체크 ──
            if (student.balance < totalCost) {
                alert("🚫 잔액이 부족하여 구매할 수 없습니다.");
                showToast("🚫 잔액이 부족하여 구매할 수 없습니다.", "danger");
                return;
            }

            // ── 일일 구매 제한 체크 ──
            const dailyLimit = db.policies.dailyPurchaseLimit !== undefined ? db.policies.dailyPurchaseLimit : 5;
            if (dailyLimit > 0) {
                const todayStr = new Date().toISOString().slice(0, 10);
                // 오늘 실구매 건수
                const todayBought = db.transactions.filter(tx =>
                    tx.studentId === currentUser.id &&
                    tx.type === "withdraw" &&
                    tx.description && tx.description.includes("상품 구매") &&
                    tx.date && tx.date.slice(0, 10) === todayStr
                ).length;
                // 오늘 고액 대기 건수
                const todayPending = (db.pendingPayments || []).filter(p =>
                    p.studentId === currentUser.id &&
                    p.status === "pending" &&
                    p.date && p.date.slice(0, 10) === todayStr
                ).length;
                if (todayBought + todayPending >= dailyLimit) {
                    alert("🚫 오늘 구매 한도를 초과했습니다.");
                    showToast("🚫 오늘 구매 한도를 초과했습니다.", "danger");
                    return;
                }
            }

            // ── 결제 승인 대기 등록 (전체 상품 승인제 일원화) ──
            showSpinner("상품 구매 신청을 전송하는 중입니다...");
            
            try {
                const pendingId = "pend_" + Date.now();
                await fs.collection("shop_orders").doc(pendingId).set({
                    id: pendingId,
                    type: "purchase_request",
                    studentId: currentUser.id,
                    studentName: student.name,
                    productId: productId,
                    productName: item.name,
                    basePrice: finalPrice,
                    vat: vat,
                    netPrice: netPrice,
                    amount: totalCost,
                    status: "pending",
                    date: new Date().toISOString()
                });
                showToast(`⏳ 구매 신청 완료! 교사의 결제 승인 후 지갑에서 ${getCurrencyName()}이 차감되고 인벤토리에 지급됩니다.`, "warning");
            } catch (error) {
                console.error("Error purchase item: ", error);
                showToast("🚫 구매 신청 중 오류가 발생했습니다. 다시 시도해 주세요.", "danger");
            } finally {
                hideSpinner();
            }
        }

        function handleSaveShopSettings() {
            const db = getDB();
            const hoursVal = document.getElementById('shop-hours-input').value.trim();
            const noticeVal = document.getElementById('shop-notice-input').value.trim();
            const limitVal = parseInt(document.getElementById('shop-approval-limit-input').value);
            const dailyLimitVal = parseInt(document.getElementById('shop-daily-limit-input').value);
            
            db.systemSettings.shopHours = hoursVal || "평일 09:00 ~ 16:00";
            db.systemSettings.shopNotice = noticeVal || "주의: 상품 구매 후 취소 및 환불은 선생님께 직접 요청해야 합니다.";
            
            if (!isNaN(limitVal) && limitVal >= 0) {
                db.policies.approvalLimit = limitVal;
            }
            if (!isNaN(dailyLimitVal) && dailyLimitVal >= 0) {
                db.policies.dailyPurchaseLimit = dailyLimitVal;
            }
            
            saveDB(db);
            showToast("⚙️ 상점 운영 및 안내 설정이 저장되었습니다.", "success");
            loadTabData("shop");
        }

        // --- 교사용 상점 탭 렌더링 ---
        function renderTeacherShopTab(db) {
            if (db.systemSettings) {
                const hoursInput = document.getElementById('shop-hours-input');
                const noticeInput = document.getElementById('shop-notice-input');
                const limitInput = document.getElementById('shop-approval-limit-input');
                const dailyLimitInput = document.getElementById('shop-daily-limit-input');
                if (hoursInput) hoursInput.value = db.systemSettings.shopHours || "평일 09:00 ~ 16:00";
                if (noticeInput) noticeInput.value = db.systemSettings.shopNotice || "주의: 상품 구매 후 취소 및 환불은 선생님께 직접 요청해야 합니다.";
                if (limitInput) limitInput.value = db.policies.approvalLimit !== undefined ? db.policies.approvalLimit : 150;
                if (dailyLimitInput) dailyLimitInput.value = db.policies.dailyPurchaseLimit !== undefined ? db.policies.dailyPurchaseLimit : 5;
            }
            // 대시보드 위젯 집계
            let totalCoupons = 0;
            let totalSnacks = 0;
            db.shop.forEach(p => {
                if (p.category === 'coupon') totalCoupons += p.purchaseCount;
                else totalSnacks += p.purchaseCount;
            });
            document.getElementById('coupon-sales-count').innerText = `${totalCoupons}개`;
            document.getElementById('snack-sales-count').innerText = `${totalSnacks}개`;

            // 결제 승인 요청 테이블
            const pendingTbody = document.getElementById('teacher-shop-pending-tbody');
            pendingTbody.innerHTML = "";
            const pendings = db.pendingPayments.filter(p => p.status === 'pending');

            if (pendings.length === 0) {
                pendingTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">결제 승인 건 없음</td></tr>`;
            } else {
                pendings.forEach(p => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${p.studentName}</strong></td>
                        <td>${p.productName}</td>
                        <td style="font-weight:bold; color:#d9480f;">${p.amount} ${getCurrencyName()}</td>
                        <td>
                            <button class="btn btn-success" style="font-size:0.65rem; padding:2px 6px;" onclick="handleApproveShopPayment('${p.id}', true)">승인</button>
                            <button class="btn btn-danger" style="font-size:0.65rem; padding:2px 6px;" onclick="handleApproveShopPayment('${p.id}', false)">반려</button>
                        </td>
                    `;
                    pendingTbody.appendChild(tr);
                });
            }

            // 아이템 사용 요청 승인 대기 리스트
            const useReqTbody = document.getElementById('teacher-item-requests-tbody');
            if (useReqTbody) {
                useReqTbody.innerHTML = "";
                const pendingUseReqs = (db.useRequests || []).filter(r => r.status === 'pending');
                if (pendingUseReqs.length === 0) {
                    useReqTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">아이템 사용 요청 건 없음</td></tr>`;
                } else {
                    pendingUseReqs.forEach(r => {
                        const tr = document.createElement('tr');
                        const dateStr = new Date(r.date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                        tr.innerHTML = `
                            <td><strong>${r.studentName} (${r.studentId})</strong></td>
                            <td>${r.emoji || '🎫'} ${r.productName}</td>
                            <td>${dateStr}</td>
                            <td>
                                <button class="btn btn-success" style="font-size:0.65rem; padding:2px 6px;" onclick="handleApproveUseRequest('${r.id}', true)">승인</button>
                                <button class="btn btn-danger" style="font-size:0.65rem; padding:2px 6px;" onclick="handleApproveUseRequest('${r.id}', false)">반려</button>
                            </td>
                        `;
                        useReqTbody.appendChild(tr);
                    });
                }
            }

            // 학생 보유 미사용 권리/간식 리스트
            const invTbody = document.getElementById('teacher-inventory-management-tbody');
            invTbody.innerHTML = "";
            const activeInvs = db.inventory.filter(inv => inv.quantity > 0);

            if (activeInvs.length === 0) {
                invTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">현재 보유 중인 아이템이 없습니다.</td></tr>`;
            } else {
                activeInvs.forEach(inv => {
                    const student = db.students.find(s => s.id === inv.studentId);
                    const prod = db.shop.find(p => p.id === inv.productId);
                    if (student && prod) {
                        const tr = document.createElement('tr');
                        tr.style.cursor = "pointer";

                        let pDateText = "구매 정보 없음";
                        if (inv.purchaseDate) {
                            const d = new Date(inv.purchaseDate);
                            const pad = (n) => n.toString().padStart(2, '0');
                            pDateText = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        }
                        tr.title = `구매 일시: ${pDateText}`;
                        tr.onclick = (e) => {
                            if (e.target.tagName !== 'BUTTON') {
                                alert(`👶 ${student.name} 학생의 보유 아이템 상세\n📦 아이템: ${prod.name}\n📅 구매 일시: ${pDateText}`);
                            }
                        };

                        const modDate = new Date(inv.lastUpdated).toLocaleDateString();
                        const catText = prod.category === 'coupon' ? '🎫 권리' : '🍗 간식';
                        tr.innerHTML = `
                            <td><strong>${student.name} (${student.id})</strong></td>
                            <td>${prod.name}</td>
                            <td>${catText}</td>
                            <td style="font-weight:bold;">${inv.quantity}개</td>
                            <td><span style="font-size:0.8rem; color:#868e96;">${modDate}</span></td>
                            <td>
                                <button class="btn btn-danger" style="font-size:0.7rem; padding:4px 8px;" onclick="handleDeductInventoryItem('${inv.studentId}', '${inv.productId}')">사용 처리 (차감)</button>
                            </td>
                        `;
                        invTbody.appendChild(tr);
                    }
                });
            }

            // 상품 진열 관리 렌더링 (teacher-shop-items-management-tbody 테이블로 표시)
            const itemsMgmtTbody = document.getElementById('teacher-shop-items-management-tbody');
            if (itemsMgmtTbody) {
                itemsMgmtTbody.innerHTML = "";
                if (db.shop.length === 0) {
                    itemsMgmtTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">등록된 상품이 없습니다.</td></tr>`;
                } else {
                    db.shop.forEach((item, idx) => {
                        const tr = document.createElement('tr');
                        const catText = item.category === 'coupon' ? '🎫 권리' : '🍗 간식';
                        const goalText = item.weeklyGoal === -1 ? '무제한' : `${item.weeklyGoal}회`;
                        const editBorder = editingShopItemId === item.id ? 'background:#fff3bf;' : '';
                        tr.setAttribute('style', editBorder);
                        tr.innerHTML = `
                            <td style="font-size:1.4rem; text-align:center;">${item.emoji || '🎫'}</td>
                            <td><strong>${item.name}</strong></td>
                            <td>${catText}</td>
                            <td style="font-weight:bold; color:#d9480f;">${item.basePrice.toLocaleString()} ${getCurrencyName()} <span style="font-size:0.72rem; color:var(--text-muted);">(VAT포함)</span></td>
                            <td>${goalText}</td>
                            <td style="font-weight:bold;">${item.purchaseCount || 0}회</td>
                            <td>
                                <div style="display:flex; gap:3px; flex-wrap:wrap;">
                                    <button class="btn btn-secondary" style="font-size:0.7rem; padding:3px 5px;" onclick="moveShopItemOrder('${item.id}', 'up')" ${idx === 0 ? 'disabled' : ''}>▲</button>
                                    <button class="btn btn-secondary" style="font-size:0.7rem; padding:3px 5px;" onclick="moveShopItemOrder('${item.id}', 'down')" ${idx === db.shop.length - 1 ? 'disabled' : ''}>▼</button>
                                    <button class="btn btn-primary" style="font-size:0.7rem; padding:3px 6px;" onclick="handleEditShopItem('${item.id}')">수정</button>
                                    <button class="btn btn-danger" style="font-size:0.7rem; padding:3px 6px;" onclick="handleDeleteShopItem('${item.id}')">삭제</button>
                                </div>
                            </td>
                        `;
                        itemsMgmtTbody.appendChild(tr);
                    });
                }
            }

            // 구매내역 대장 드롭다운 데이터 채우기
            const studentSel = document.getElementById('shop-log-filter-student');
            const productSel = document.getElementById('shop-log-filter-product');
            if (studentSel) {
                const curSt = studentSel.value;
                studentSel.innerHTML = '<option value="">전체 학생</option>';
                db.students.filter(s => s.role !== 'teacher').forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.name;
                    opt.innerText = s.name;
                    studentSel.appendChild(opt);
                });
                if (curSt) studentSel.value = curSt;
            }
            if (productSel) {
                const curPr = productSel.value;
                productSel.innerHTML = '<option value="">전체 상품</option>';
                db.shop.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.name;
                    opt.innerText = p.name;
                    productSel.appendChild(opt);
                });
                if (curPr) productSel.value = curPr;
            }

            // 구매 내역 대장 자동 렌더
            renderShopPurchaseLog();
        }

        // 상점 구매 내역 대장 렌더링 (필터 포함)
        function renderShopPurchaseLog() {
            const db = getDB();
            const tbody = document.getElementById('shop-purchase-log-tbody');
            const summaryEl = document.getElementById('shop-log-summary');
            if (!tbody) return;

            const dateFrom = (document.getElementById('shop-log-filter-date-from') || {}).value || '';
            const dateTo = (document.getElementById('shop-log-filter-date-to') || {}).value || '';
            const studentFilter = ((document.getElementById('shop-log-filter-student') || {}).value || '').trim().toLowerCase();
            const productFilter = ((document.getElementById('shop-log-filter-product') || {}).value || '').trim().toLowerCase();

            let logs = (db.shopPurchaseLog || []).slice().reverse();

            if (dateFrom) logs = logs.filter(l => l.date.slice(0, 10) >= dateFrom);
            if (dateTo)   logs = logs.filter(l => l.date.slice(0, 10) <= dateTo);
            if (studentFilter) logs = logs.filter(l => (l.studentName || '').toLowerCase().includes(studentFilter));
            if (productFilter) logs = logs.filter(l => (l.productName || '').toLowerCase().includes(productFilter));

            tbody.innerHTML = '';
            if (logs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">조건에 맞는 구매 내역이 없습니다.</td></tr>`;
                if (summaryEl) summaryEl.textContent = '';
                return;
            }

            let totalCost = 0, totalVat = 0;
            logs.forEach(l => {
                const d = new Date(l.date);
                const purchaseDateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                const usedDateStr = l.usedDate ? (() => { const ud = new Date(l.usedDate); return `${ud.getFullYear()}-${String(ud.getMonth()+1).padStart(2,'0')}-${String(ud.getDate()).padStart(2,'0')}`; })() : '<span style="color:var(--text-muted); font-size:0.78rem;">미사용</span>';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-size:0.8rem; white-space:nowrap;">${purchaseDateStr}</td>
                    <td style="font-size:0.8rem; white-space:nowrap;">${usedDateStr}</td>
                    <td><strong>${l.studentName || l.studentId}</strong></td>
                    <td>${l.productName}</td>
                    <td style="font-weight:bold; color:#d9480f;">${(l.totalCost||0).toLocaleString()} ${getCurrencyName()}</td>
                    <td>${(l.netPrice||0).toLocaleString()} ${getCurrencyName()}</td>
                    <td style="color:#2b8a3e;">${(l.vat||0).toLocaleString()} ${getCurrencyName()}</td>
                `;
                tbody.appendChild(tr);
                totalCost += (l.totalCost || 0);
                totalVat  += (l.vat || 0);
            });

            if (summaryEl) {
                summaryEl.innerHTML = `총 <strong>${logs.length}건</strong> | 결제 합계: <strong>${totalCost.toLocaleString()} ${getCurrencyName()}</strong> | 부가세 합계: <strong>${totalVat.toLocaleString()} ${getCurrencyName()}</strong>`;
            }
        }

        // 상점 내역 필터 초기화
        function clearShopLogFilter() {
            const ids = ['shop-log-filter-date-from', 'shop-log-filter-date-to', 'shop-log-filter-student', 'shop-log-filter-product'];
            ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            renderShopPurchaseLog();
        }

        // 위젯 아코디언 토글 (누적 권리/간식 상세 목록)
        function toggleWidgetDetails(type) {
            const db = getDB();
            const containerId = type === 'coupon' ? 'widget-coupon-detail' : 'widget-snack-detail';
            let detailEl = document.getElementById(containerId);
            if (detailEl) {
                detailEl.style.display = detailEl.style.display === 'none' ? 'block' : 'none';
                return;
            }
            // 최초 생성
            const parentEl = document.getElementById(type === 'coupon' ? 'widget-coupon-box' : 'widget-snack-box');
            if (!parentEl) return;
            const items = db.shop.filter(p => p.category === type);
            const logs = (db.shopPurchaseLog || []).filter(l => l.category === type);
            detailEl = document.createElement('div');
            detailEl.id = containerId;
            detailEl.style.cssText = 'margin-top: 10px; max-height: 200px; overflow-y: auto; font-size: 0.8rem;';
            if (items.length === 0) {
                detailEl.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding: 8px;">상품 없음</div>';
            } else {
                detailEl.innerHTML = items.map(it => {
                    const cnt = logs.filter(l => l.productId === it.id).length;
                    return `<div style="display:flex; justify-content:space-between; padding: 5px 0; border-bottom: 1px dashed var(--border-color);">
                        <span>${it.emoji || '🎫'} ${it.name}</span>
                        <span style="font-weight:bold; color:#d9480f;">${cnt}회 판매</span>
                    </div>`;
                }).join('');
            }
            parentEl.appendChild(detailEl);
        }

        // 상품 삭제
        function handleDeleteShopItem(itemId) {
            if (!confirm("⚠️ 정말로 이 상품을 상점에서 삭제하시겠습니까? (이미 학생들이 구매하여 보관 중인 내역이나 인벤토리는 보존됩니다.)")) return;
            const db = getDB();
            db.shop = db.shop.filter(p => p.id !== itemId);
            if (editingShopItemId === itemId) {
                handleCancelEditShopItem();
            }
            saveDB(db);
            showToast("🛍️ 상품이 성공적으로 삭제되었습니다.", "success");
            loadTabData("shop");
        }

        // 상점 상품 신규 등록 및 수정
        function handleRegisterShopItem() {
            const name = document.getElementById('new-item-name').value.trim();
            const cat = document.getElementById('new-item-cat').value;
            const price = parseInt(document.getElementById('new-item-price').value);
            const goal = parseInt(document.getElementById('new-item-goal').value);
            const emoji = document.getElementById('new-item-emoji').value.trim() || (cat === 'coupon' ? '🎫' : '🍗');
            const desc = document.getElementById('new-item-desc').value.trim() || "상품 상세 설명이 비어있습니다.";

            if (!name || isNaN(price) || price <= 0 || isNaN(goal) || (goal <= 0 && goal !== -1)) {
                showToast("상품 정보를 정확하게 입력해 주세요.", "danger");
                return;
            }

            const db = getDB();

            if (editingShopItemId) {
                const item = db.shop.find(p => p.id === editingShopItemId);
                if (item) {
                    item.name = name;
                    item.category = cat;
                    item.basePrice = price;
                    item.price = price;
                    item.weeklyGoal = goal;
                    item.emoji = emoji;
                    item.description = desc;
                    showToast("🛍️ 상품 정보가 성공적으로 수정되었습니다.", "success");
                }
                editingShopItemId = null;
            } else {
                const itemId = "p_" + Date.now();
                db.shop.push({
                    id: itemId,
                    name: name,
                    category: cat,
                    price: price,
                    basePrice: price,
                    weeklyGoal: goal,
                    purchaseCount: 0,
                    emoji: emoji,
                    description: desc
                });
                showToast("🛍️ 신규 물품이 상점에 입고 완료되었습니다.", "success");
            }

            saveDB(db);
            
            // 폼 초기화 및 버튼 복구
            document.getElementById('new-item-name').value = "";
            document.getElementById('new-item-price').value = "";
            document.getElementById('new-item-emoji').value = "";
            document.getElementById('new-item-goal').value = "3";
            document.getElementById('new-item-desc').value = "";

            const regBtn = document.getElementById('btn-register-shop-item');
            if (regBtn) {
                regBtn.innerText = "상점 상품 등록";
                regBtn.classList.remove('btn-success');
                regBtn.classList.add('btn-primary');
            }
            const cancelBtn = document.getElementById('btn-cancel-edit-shop-item');
            if (cancelBtn) cancelBtn.style.display = "none";

            loadTabData("shop");
        }

        // 아이템 사용 요청 교사 승인/반려
        async function handleApproveUseRequest(reqId, isApprove) {
            const db = getDB();
            const req = db.useRequests.find(r => r.id === reqId);
            if (!req) return;

            const student = db.students.find(s => s.id === req.studentId);
            const inventoryItem = db.inventory.find(inv => inv.id === req.inventoryId);

            showSpinner("사용 요청 처리 중입니다...");

            try {
                if (isApprove) {
                    if (!inventoryItem) {
                        showToast("해당 학생이 아이템을 보유하고 있지 않아 승인할 수 없습니다.", "danger");
                        await fs.collection("shop_orders").doc(reqId).delete();
                        return;
                    }

                    // 트랜잭션 실행
                    await fs.runTransaction(async (transaction) => {
                        const invRef = fs.collection("inventory").doc(req.inventoryId);
                        const reqRef = fs.collection("shop_orders").doc(reqId);
                        
                        const invDoc = await transaction.get(invRef);
                        const reqDoc = await transaction.get(reqRef);

                        if (!reqDoc.exists || reqDoc.data().status !== "pending") {
                            throw new Error("이미 처리된 사용 요청입니다.");
                        }

                        if (!invDoc.exists || (invDoc.data().quantity || 0) <= 0) {
                            throw new Error("보유하고 있는 아이템이 없습니다.");
                        }

                        // 1. 인벤토리에서 완전 제거
                        transaction.delete(invRef);

                        // 2. 대장 기록용 사용 날짜(usedDate) 동기화 갱신
                        const purchasesRef = fs.collection("shop_orders");
                        const querySnapshot = await purchasesRef
                            .where("studentId", "==", req.studentId)
                            .where("productId", "==", req.productId)
                            .where("type", "==", "completed_purchase")
                            .get();
                        
                        let targetPurchaseDocRef = null;
                        querySnapshot.forEach(doc => {
                            const data = doc.data();
                            if (!data.usedDate && !targetPurchaseDocRef) {
                                targetPurchaseDocRef = doc.ref;
                            }
                        });

                        if (targetPurchaseDocRef) {
                            transaction.update(targetPurchaseDocRef, {
                                usedDate: new Date().toISOString()
                            });
                        }

                        // 사용 요청 문서는 type을 "completed_use"로 바꾸어 대장에 남긴다.
                        transaction.update(reqRef, {
                            type: "completed_use",
                            status: "approved",
                            usedDate: new Date().toISOString()
                        });

                        // 3. 거래 내역 기재
                        const txId = "tx_use_app_" + Date.now();
                        const txRef = fs.collection("transactions").doc(txId);
                        transaction.set(txRef, {
                            id: txId,
                            studentId: req.studentId,
                            date: new Date().toISOString(),
                            description: `🎒 소유물 사용 최종 승인: ${req.productName} (수량 1개 사용 소멸)`,
                            type: "withdraw",
                            amount: 0,
                            balanceAfter: student ? student.balance : 0,
                            isSavingsMaturity: false
                        });
                    });

                    showToast(`✔️ ${student ? student.name : req.studentId} 학생의 ${req.productName} 사용이 최종 승인되었습니다.`, "success");
                } else {
                    // 반려 시
                    await fs.collection("shop_orders").doc(reqId).delete();
                    showToast(`❌ ${student ? student.name : req.studentId} 학생의 사용 요청을 반려 처리했습니다.`, "warning");
                }
            } catch (error) {
                console.error("Error approving use request: ", error);
                showToast("🚫 사용 승인 중 오류가 발생했습니다: " + error.message, "danger");
            } finally {
                hideSpinner();
            }
        }

        // 교사용 상품 순서 정렬
        function moveShopItemOrder(itemId, direction) {
            const db = getDB();
            const idx = db.shop.findIndex(p => p.id === itemId);
            if (idx === -1) return;

            if (direction === 'up' && idx > 0) {
                const temp = db.shop[idx];
                db.shop[idx] = db.shop[idx - 1];
                db.shop[idx - 1] = temp;
            } else if (direction === 'down' && idx < db.shop.length - 1) {
                const temp = db.shop[idx];
                db.shop[idx] = db.shop[idx + 1];
                db.shop[idx + 1] = temp;
            }

            saveDB(db);
            loadTabData("shop");
        }

        // 교사용 상품 수정 모드 진입
        function handleEditShopItem(itemId) {
            const db = getDB();
            const item = db.shop.find(p => p.id === itemId);
            if (!item) return;

            editingShopItemId = itemId;
            
            // 폼 필드 채우기
            document.getElementById('new-item-name').value = item.name;
            document.getElementById('new-item-cat').value = item.category;
            document.getElementById('new-item-price').value = item.basePrice;
            document.getElementById('new-item-emoji').value = item.emoji || "";
            document.getElementById('new-item-goal').value = item.weeklyGoal;
            document.getElementById('new-item-desc').value = item.description || "";

            // UI 변경
            const regBtn = document.getElementById('btn-register-shop-item');
            if (regBtn) {
                regBtn.innerText = "💾 상품 수정 완료";
                regBtn.classList.remove('btn-primary');
                regBtn.classList.add('btn-success');
            }
            const cancelBtn = document.getElementById('btn-cancel-edit-shop-item');
            if (cancelBtn) cancelBtn.style.display = "block";

            // 관리 영역으로 스크롤 이동
            document.getElementById('new-item-name').scrollIntoView({ behavior: 'smooth' });
            
            // 상품 카드들에 표시되는 border 갱신용으로 한 번 더 렌더링
            renderTeacherShopTab(db);
        }

        // 교사용 상품 수정 취소
        function handleCancelEditShopItem() {
            editingShopItemId = null;
            document.getElementById('new-item-name').value = "";
            document.getElementById('new-item-price').value = "";
            document.getElementById('new-item-emoji').value = "";
            document.getElementById('new-item-goal').value = "3";
            document.getElementById('new-item-desc').value = "";

            const regBtn = document.getElementById('btn-register-shop-item');
            if (regBtn) {
                regBtn.innerText = "상점 상품 등록";
                regBtn.classList.remove('btn-success');
                regBtn.classList.add('btn-primary');
            }
            const cancelBtn = document.getElementById('btn-cancel-edit-shop-item');
            if (cancelBtn) cancelBtn.style.display = "none";

            const db = getDB();
            renderTeacherShopTab(db);
        }

        // 상점 결제 처리 승인/반려
        async function handleApproveShopPayment(paymentId, isApprove) {
            const db = getDB();
            const payment = db.pendingPayments.find(p => p.id === paymentId);
            if (!payment) return;

            const student = db.students.find(s => s.id === payment.studentId);
            const item = db.shop.find(s => s.id === payment.productId);

            showSpinner("결제 승인 처리 중입니다...");

            try {
                if (isApprove) {
                    if (student.balance < payment.amount) {
                        showToast("학생의 치킨 잔액이 부족해져 결제를 승인할 수 없습니다.", "danger");
                        return;
                    }

                    const vat = payment.vat !== undefined ? payment.vat : Math.round(payment.amount * 0.1);
                    const netPrice = payment.amount - vat;

                    // 트랜잭션 실행
                    await fs.runTransaction(async (transaction) => {
                        const studentRef = fs.collection("users").doc(student.id);
                        const taxRef = fs.collection("tax").doc("state");
                        const itemRef = fs.collection("shop_items").doc(payment.productId);
                        const paymentRef = fs.collection("shop_orders").doc(paymentId);

                        const studentDoc = await transaction.get(studentRef);
                        const taxDoc = await transaction.get(taxRef);
                        const itemDoc = await transaction.get(itemRef);
                        const paymentDoc = await transaction.get(paymentRef);

                        if (!paymentDoc.exists || paymentDoc.data().status !== "pending") {
                            throw new Error("이미 처리된 결제건입니다.");
                        }

                        const currentStudentBalance = studentDoc.exists ? (studentDoc.data().balance || 0) : 0;
                        if (currentStudentBalance < payment.amount) {
                            throw new Error("잔액이 부족합니다.");
                        }

                        // 1. 학생 잔고 차감
                        transaction.update(studentRef, { balance: currentStudentBalance - payment.amount });

                        // 2. 세금 누적
                        const currentTax = taxDoc.exists ? (taxDoc.data().totalTax || 0) : 0;
                        transaction.update(taxRef, { totalTax: currentTax + vat });

                        // 3. 상품 구매수 누적
                        const currentPurchaseCount = itemDoc.exists ? (itemDoc.data().purchaseCount || 0) : 0;
                        transaction.update(itemRef, { purchaseCount: currentPurchaseCount + 1 });

                        // 4. 결제 요청 상태 업데이트 (completed_purchase 타입으로 변경)
                        transaction.update(paymentRef, {
                            type: "completed_purchase",
                            status: "approved",
                            usedDate: null
                        });

                        // 5. 세금 거래 내역 추가
                        const taxTxId = "tax_shop_app_" + Date.now();
                        const taxTxRef = fs.collection("tax_transactions").doc(taxTxId);
                        transaction.set(taxTxRef, {
                            id: taxTxId,
                            date: new Date().toISOString(),
                            type: "deposit",
                            amount: vat,
                            description: `상점 결제 승인 부가세 세입 (${student.name} - ${payment.productName}, 순매출 ${netPrice}치킨)`
                        });

                        // 6. 학생 거래 내역 추가
                        const txId = "tx_app_" + Date.now();
                        const txRef = fs.collection("transactions").doc(txId);
                        transaction.set(txRef, {
                            id: txId,
                            studentId: student.id,
                            date: new Date().toISOString(),
                            description: `🛍️ 상품 구매 최종 승인: ${payment.productName} (VAT포함 ${payment.amount}, 순매출 ${netPrice}, 부가세 ${vat})`,
                            type: "withdraw",
                            amount: payment.amount,
                            balanceAfter: currentStudentBalance - payment.amount,
                            productId: payment.productId,
                            productName: payment.productName,
                            isSavingsMaturity: false
                        });

                        // 7. 인벤토리에 추가
                        const invId = "inv_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                        const invRef = fs.collection("inventory").doc(invId);
                        transaction.set(invRef, {
                            id: invId,
                            studentId: student.id,
                            productId: payment.productId,
                            quantity: 1,
                            lastUpdated: new Date().toISOString(),
                            purchaseDate: new Date().toISOString()
                        });
                    });

                    showToast(`✔️ 결제 승인 완료 (${payment.amount}치킨, VAT ${vat} 포함)`, "success");
                } else {
                    // 반려 시
                    await fs.collection("shop_orders").doc(paymentId).delete();
                    showToast("❌ 결제 반려 처리", "warning");
                }
            } catch (error) {
                console.error("Error approving shop payment: ", error);
                showToast("🚫 결제 승인 중 오류가 발생했습니다: " + error.message, "danger");
            } finally {
                hideSpinner();
            }
        }

        // 인벤토리 권리/간식 소모(차감)
        async function handleDeductInventoryItem(studentId, productId) {
            const db = getDB();
            const inv = db.inventory.find(i => i.studentId === studentId && i.productId === productId);
            if (!inv) return;

            const student = db.students.find(s => s.id === studentId);
            const prod = db.shop.find(p => p.id === productId);
            if (!student || !prod) return;

            showSpinner("소유물 사용 완료 서명을 처리 중입니다...");

            try {
                // 트랜잭션 처리
                await fs.runTransaction(async (transaction) => {
                    const invRef = fs.collection("inventory").doc(inv.id);
                    const invDoc = await transaction.get(invRef);

                    if (!invDoc.exists) {
                        throw new Error("보유하고 있는 아이템이 없습니다.");
                    }

                    // 1. 인벤토리에서 완전 제거
                    transaction.delete(invRef);

                    // 2. 대장 기록용 사용 날짜(usedDate) 갱신
                    const purchasesRef = fs.collection("shop_orders");
                    const querySnapshot = await purchasesRef
                        .where("studentId", "==", studentId)
                        .where("productId", "==", productId)
                        .where("type", "==", "completed_purchase")
                        .get();
                    
                    let targetPurchaseDocRef = null;
                    querySnapshot.forEach(doc => {
                        const data = doc.data();
                        if (!data.usedDate && !targetPurchaseDocRef) {
                            targetPurchaseDocRef = doc.ref;
                        }
                    });

                    if (targetPurchaseDocRef) {
                        transaction.update(targetPurchaseDocRef, {
                            usedDate: new Date().toISOString()
                        });
                    }

                    // 3. 거래 내역 기재
                    const txId = "tx_use_item_" + Date.now();
                    const txRef = fs.collection("transactions").doc(txId);
                    transaction.set(txRef, {
                        id: txId,
                        studentId: studentId,
                        date: new Date().toISOString(),
                        description: `📢 소유물 사용 소모: ${prod.name} (선생님 사용 완료 서명)`,
                        type: "withdraw",
                        amount: 0,
                        balanceAfter: student.balance,
                        isSavingsMaturity: false
                    });
                });

                showToast(`✔️ ${student.name} 학생의 ${prod.name} 사용 완료 서명이 처리되었습니다.`, "success");
            } catch (error) {
                console.error("Error deducting inventory item: ", error);
                showToast("🚫 처리 중 오류가 발생했습니다: " + error.message, "danger");
            } finally {
                hideSpinner();
            }
        }

        // ==========================================
        // 6. TAB 4: ENVIRONMENT LOGIC
        // ==========================================
        let tempReportImage = null;
        let tempReportFile = null;

        function previewEnvImage(event) {
            const file = event.target.files[0];
            if (!file) return;
            tempReportFile = file;
            const reader = new FileReader();
            reader.onload = function() {
                const preview = document.getElementById('env-preview');
                preview.src = reader.result;
                preview.style.display = "block";
                document.getElementById('upload-instruction').style.display = "none";
                tempReportImage = reader.result;
            }
            reader.readAsDataURL(file);
        }

        async function handleSubmitEnvReport() {
            const actType = document.getElementById('env-activity-type').value;
            const desc = document.getElementById('env-desc').value.trim();
            if (!tempReportFile) {
                showToast("인증 사진을 업로드해 주세요.", "danger");
                return;
            }
            if (!desc) {
                showToast("인증 활동 내용을 구체적으로 입력하세요.", "danger");
                return;
            }

            // 날짜 picker 값 사용 (없으면 오늘)
            const datePicker = document.getElementById('env-report-date');
            const selectedDate = (datePicker && datePicker.value) ? datePicker.value : new Date().toISOString().split('T')[0];

            if (!confirm("환경 정화 인증 보고서를 제출하시겠습니까?")) return;

            const submitBtn = document.querySelector("#tab-environment button[onclick='handleSubmitEnvReport()']");
            if (submitBtn) submitBtn.disabled = true;
            showSpinner("환경 정화 인증 사진 및 보고서를 업로드하는 중입니다...");

            try {
                const reportId = "env_" + Date.now();
                
                // Storage 업로드
                const storageRef = firebase.storage().ref();
                const fileExtension = tempReportFile.name.split('.').pop() || 'png';
                const fileRef = storageRef.child(`env_reports/${currentUser.id}_${Date.now()}.${fileExtension}`);
                
                await fileRef.put(tempReportFile);
                const downloadUrl = await fileRef.getDownloadURL();

                // Firestore 저장
                await fs.collection("env_reports").doc(reportId).set({
                    id: reportId,
                    studentId: currentUser.id,
                    studentName: currentUser.name,
                    image: downloadUrl,
                    activityType: actType,
                    desc: desc,
                    status: "pending",
                    date: new Date().toISOString(),
                    activityDate: selectedDate
                });

                document.getElementById('env-preview').style.display = "none";
                document.getElementById('upload-instruction').style.display = "block";
                document.getElementById('env-desc').value = "";
                if (datePicker) datePicker.value = '';
                
                const db = getDB();
                if (db.envActivityTypes && db.envActivityTypes.length > 0) {
                    document.getElementById('env-activity-type').value = db.envActivityTypes[0].name;
                }
                tempReportImage = null;
                tempReportFile = null;

                showToast("🌿 환경 인증 신청서가 제출되었습니다. 교사 확인 후 마일리지가 지급됩니다.", "success");
            } catch (error) {
                console.error("Error submitting env report: ", error);
                showToast("🚫 보고서 제출 중 오류가 발생했습니다. 다시 시도해 주세요.", "danger");
            } finally {
                if (submitBtn) submitBtn.disabled = false;
                hideSpinner();
            }
        }

        // 교사용 일별 환경 실천 출석 테이블 렌더링 (Override 데이터 반영) - 가로형 카드 개편
        function renderTeacherEnvAttendanceTable(db, selectedDate) {
            const attTbody = document.getElementById('teacher-env-attendance-tbody');
            if (!attTbody) return;

            attTbody.innerHTML = "";
            const allChk = document.getElementById('env-check-all');
            if (allChk) allChk.checked = false;

            // 해당 일자의 기존 정산 데이터 조회
            const dayRecords = db.monthlyAttendance.filter(att => att.date === selectedDate);
            const isAlreadySettled = dayRecords.length > 0;

            db.students.filter(s => s.role !== 'teacher').forEach(st => {
                const record = dayRecords.find(r => r.studentId === st.id);
                const plateChecked = record ? record.plate : false;
                const handChecked = record ? record.handkerchief : false;

                const card = document.createElement('div');
                card.className = 'teacher-env-card';
                card.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; box-sizing: border-box;">
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: bold; flex-shrink: 0; min-width: 80px;">
                            <input type="checkbox" class="env-row-select" data-student-id="${st.id}" style="transform: scale(1.1); cursor: pointer;" onchange="syncAllCheckState()">
                            <span style="font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${st.name} (${st.id})">${st.name}</span>
                        </label>
                        <div style="display: flex; gap: 6px; align-items: center; flex-grow: 1; justify-content: flex-end;">
                            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 0.8rem; background: var(--background); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-color); white-space: nowrap;">
                                <input type="checkbox" class="env-chk-handkerchief" data-student-id="${st.id}" ${handChecked ? 'checked' : ''} style="transform: scale(1.1); cursor: pointer;">
                                <span>🌿 손수건</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 0.8rem; background: var(--background); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-color); white-space: nowrap;">
                                <input type="checkbox" class="env-chk-plate" data-student-id="${st.id}" ${plateChecked ? 'checked' : ''} style="transform: scale(1.1); cursor: pointer;">
                                <span>🍱 급식</span>
                            </label>
                        </div>
                    </div>
                `;
                attTbody.appendChild(card);
            });

            // 안내 메시지 동적 업데이트
            const infoText = document.getElementById('teacher-env-settle-info');
            if (infoText) {
                if (isAlreadySettled) {
                    infoText.innerHTML = `<span style="color:#d9480f; font-weight:bold;">⚠️ 해당 일자(${selectedDate})에 이미 완료된 정산 데이터가 있습니다. 수정 후 저장하면 덮어쓰기(Override)됩니다.</span>`;
                } else {
                    infoText.innerHTML = `정산할 날짜를 선택하고 학생들의 급식 잔반 및 손수건 실천 여부를 확인하여 정산합니다. (일 1회 정산 가능)`;
                }
            }
        }

        // --- 교사용 환경인증 갤러리 및 단가/출석 렌더링 ---
        function renderTeacherEnvTab(db) {
            // 오늘 날짜 표시 및 picker 초기 세팅
            const todayStr = new Date().toISOString().split('T')[0];
            const datePicker = document.getElementById('env-today-date-picker');
            if (datePicker) {
                if (!datePicker.value) datePicker.value = todayStr;
                datePicker.onchange = () => {
                    renderTeacherEnvAttendanceTable(getDB(), datePicker.value);
                };
            }

            // 개별 마일리지 수동 지급 드롭다운 채우기
            const select = document.getElementById('manual-mileage-student-select');
            if (select) {
                select.innerHTML = '<option value="">-- 학생 선택 --</option>';
                db.students.forEach(st => {
                    const opt = document.createElement('option');
                    opt.value = st.id;
                    opt.innerText = `${st.name} (${st.id})`;
                    select.appendChild(opt);
                });
            }

            // 환전 토글 초기화 (교사 환경 탭 전용)
            const envTabToggle = document.getElementById('env-tab-exchange-toggle');
            if (envTabToggle) envTabToggle.checked = db.systemSettings.envExchangeActive !== false;

            // 보상 단가 값 채우기
            if (db.envSettings) {
                document.getElementById('env-plate-reward').value = db.envSettings.plateReward;
                document.getElementById('env-handkerchief-reward').value = db.envSettings.handkerchiefReward;
            }

            // 일별 출석 테이블 렌더링 호출
            renderTeacherEnvAttendanceTable(db, datePicker ? datePicker.value : todayStr);

            // 활동 유형 CRUD 표 렌더링
            renderEnvActivityTypes(db);

            // 보고서 갤러리
            const grid = document.getElementById('teacher-env-gallery-grid');
            grid.innerHTML = "";

            const pendings = db.envReports.filter(r => r.status === 'pending');
            if (pendings.length === 0) {
                grid.innerHTML = `<p style="color: var(--text-muted); width: 100%;">새로 접수된 환경 실천 인증 보고서가 없습니다.</p>`;
                renderEnvStatistics(db);
                return;
            }

            pendings.forEach(rep => {
                const card = document.createElement('div');
                card.className = "shop-item-card";
                card.style.textAlign = "left";

                const rDate = new Date(rep.date).toLocaleDateString();
                const actType = rep.activityType || "기타";
                
                let badgeBg = "#f1f3f5";
                let badgeColor = "#495057";
                
                // 활동 유형에 해당하는 권장 보상 마일리지
                const matchedAct = db.envActivityTypes.find(act => act.name === actType);
                let defaultReward = matchedAct ? matchedAct.reward : 15;
                
                if (actType === "분리수거") {
                    badgeBg = "#e3fafc";
                    badgeColor = "#0b7285";
                } else if (actType === "교실 청소") {
                    badgeBg = "#fff3bf";
                    badgeColor = "#d9480f";
                } else if (actType === "에너지 절약") {
                    badgeBg = "#e8f8f5";
                    badgeColor = "#2ecc71";
                }

                card.innerHTML = `
                    <img src="${rep.image}" style="width:100%; height:150px; object-fit:cover; border-radius:10px; border:1px solid #eee; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-weight:bold; font-size:1.05rem;">👶 ${rep.studentName}</div>
                        <span class="product-badge" style="background:${badgeBg}; color:${badgeColor}; font-size:0.75rem; margin-bottom:0;">${actType}</span>
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:5px; margin-bottom:10px;">제출일: ${rDate}</div>
                    <p style="font-size:0.85rem; background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #edf2f7; margin-bottom:15px; min-height:60px;">
                        ${rep.desc}
                    </p>
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <span style="font-size:0.85rem; font-weight:bold; color:var(--text-main);">보상액:</span>
                        <input type="number" id="reward-amount-${rep.id}" class="form-control" style="width: 80px; padding: 4px 8px; font-size: 0.85rem;" value="${defaultReward}" min="0">
                        <span style="font-size:0.85rem; font-weight:bold; color:var(--text-muted);">마일리지</span>
                    </div>
                    <button class="btn btn-success" onclick="approveEnvReport('${rep.id}')" style="width: 100%; justify-content: center;">💚 마일리지 승인 지급</button>
                `;
                    grid.appendChild(card);
            });

            // ✅ 승인 완료 보관함 렌더링
            const archiveGrid = document.getElementById('teacher-env-archive-grid');
            const archiveCountEl = document.getElementById('env-archive-count');
            if (archiveGrid) {
                archiveGrid.innerHTML = '';
                const approved = db.envReports.filter(r => r.status === 'approved');
                if (archiveCountEl) archiveCountEl.textContent = `(총 ${approved.length}건)`;
                if (approved.length === 0) {
                    archiveGrid.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">승인 완료된 기록이 없습니다.</p>`;
                } else {
                    [...approved].reverse().forEach(rep => {
                        const card = document.createElement('div');
                        card.style.cssText = 'background:white; border-radius:12px; padding:12px; border:1px solid #b2f2bb; box-shadow:0 2px 8px rgba(0,0,0,0.06); cursor:pointer;';
                        card.onclick = () => openTeacherEnvArchiveModal(rep.id);
                        const rDate = new Date(rep.date).toLocaleDateString('ko-KR');
                        const approvedDate = rep.approvedDate ? new Date(rep.approvedDate).toLocaleDateString('ko-KR') : '-';
                        const actDate = rep.activityDate || '-';
                        card.innerHTML = `
                            <img src="${rep.image}" style="width:100%; height:110px; object-fit:cover; border-radius:8px; margin-bottom:8px;">
                            <div style="font-weight:bold; font-size:0.9rem;">${rep.studentName}</div>
                            <div style="font-size:0.78rem; color:var(--text-muted);">활동: ${rep.activityType || '기타'} | 실천일: ${actDate}</div>
                            <div style="font-size:0.78rem; color:var(--text-muted);">제출: ${rDate} | 승인: ${approvedDate}</div>
                            <div style="margin-top:6px; font-size:0.82rem; color:#2b8a3e; font-weight:bold;">+${rep.rewardAmount || 0} 마일리지 지급</div>
                        `;
                        archiveGrid.appendChild(card);
                    });
                }
            }

            renderEnvStatistics(db);
        }

        // 보상 단가 저장
        function handleSaveEnvRewards() {
            const db = getDB();
            const plate = parseFloat(document.getElementById('env-plate-reward').value);
            const hand = parseFloat(document.getElementById('env-handkerchief-reward').value);

            if (isNaN(plate) || plate < 0 || isNaN(hand) || hand < 0) {
                showToast("올바른 보상 금액을 입력해 주세요.", "danger");
                return;
            }

            db.envSettings = {
                plateReward: plate,
                handkerchiefReward: hand
            };
            saveDB(db);
            showToast("⚙️ 환경 실천 보상 설정이 저장되었습니다.", "success");
        }

        // 일별 환경 실천 출석 정산 (교사용 Override 가능)
        function handleCalculateDailyEnvRewards() {
            const db = getDB();
            const datePicker = document.getElementById('env-today-date-picker');
            const targetDate = datePicker ? datePicker.value : new Date().toISOString().split('T')[0];

            if (!targetDate) {
                showToast("정산할 날짜를 선택해 주세요.", "danger");
                return;
            }

            if (!confirm(`📅 ${targetDate} 일자 실천 정산을 진행하시겠습니까?\n이미 정산된 데이터가 존재할 경우, 학생들의 기존 보상 마일리지 및 장부를 롤백하고 현재 설정된 내용으로 덮어씁니다(Override).`)) return;

            const plateReward = (db.envSettings && db.envSettings.plateReward) !== undefined ? db.envSettings.plateReward : 5;
            const handkerchiefReward = (db.envSettings && db.envSettings.handkerchiefReward) !== undefined ? db.envSettings.handkerchiefReward : 3;

            // 1. 해당 일자의 기존 정산 기록 모두 백업 및 DB/학생 마일리지 롤백
            const existingRecords = db.monthlyAttendance.filter(att => att.date === targetDate);
            existingRecords.forEach(rec => {
                if (rec.studentId !== "system_dummy") {
                    const st = db.students.find(s => s.id === rec.studentId);
                    if (st) {
                        st.mileageBalance = Math.max(0, (st.mileageBalance || 0) - rec.amount);
                        st.mileage = st.mileageBalance;
                    }
                }
            });

            // db.monthlyAttendance 에서 해당 날짜 기록 삭제
            db.monthlyAttendance = db.monthlyAttendance.filter(att => att.date !== targetDate);

            // 2. 새로 선택된 체크상태를 바탕으로 정산 재처리 및 기록 삽입
            const plateCheckboxes = document.querySelectorAll('.env-chk-plate');
            const handkerchiefCheckboxes = document.querySelectorAll('.env-chk-handkerchief');

            let rewardedCount = 0;
            let totalDistributed = 0;
            const newRecords = [];

            plateCheckboxes.forEach((chk) => {
                const studentId = chk.getAttribute('data-student-id');
                const plateChecked = chk.checked;
                const handChk = document.querySelector(`.env-chk-handkerchief[data-student-id="${studentId}"]`);
                const handChecked = handChk ? handChk.checked : false;

                if (plateChecked || handChecked) {
                    const student = db.students.find(s => s.id === studentId);
                    if (student) {
                        let reward = 0;
                        let descParts = [];
                        if (plateChecked) {
                            reward += plateReward;
                            descParts.push(`잔반 ZERO (+${plateReward})`);
                        }
                        if (handChecked)  {
                            reward += handkerchiefReward;
                            descParts.push(`손수건 사용 (+${handkerchiefReward})`);
                        }

                        student.mileageBalance = (student.mileageBalance || 0) + reward;
                        student.mileage = student.mileageBalance;
                        totalDistributed += reward;
                        rewardedCount++;

                        newRecords.push({
                            date: targetDate,
                            studentId,
                            plate: plateChecked,
                            handkerchief: handChecked,
                            amount: reward
                        });

                        // ✅ 마일리지 장부 분리 기록 (교사 재정산)
                        if (!Array.isArray(db.envMileageLedger)) db.envMileageLedger = [];
                        db.envMileageLedger.push({
                            id: "eml_" + Date.now() + "_" + studentId,
                            studentId,
                            studentName: student.name,
                            date: targetDate + "T00:00:00.000Z",
                            type: "attendance",
                            description: `🛠️ 출석 재정산 (교사 Override): ${descParts.join(', ')}`,
                            amount: reward
                        });
                    }
                }
            });

            if (newRecords.length === 0) {
                newRecords.push({
                    date: targetDate,
                    studentId: "system_dummy",
                    plate: false,
                    handkerchief: false,
                    amount: 0
                });
            }

            db.monthlyAttendance.push(...newRecords);
            
            // 전체 선택 체크박스 해제
            const allChk = document.getElementById('env-check-all');
            if (allChk) allChk.checked = false;

            saveDB(db);
            showToast(`🌿 [교사 마스터 권한] ${targetDate} 일자의 정산 데이터가 덮어씌워졌습니다. (총 ${rewardedCount}명 반영)`, "success");
            loadTabData("environment");
        }

        async function approveEnvReport(reportId) {
            const db = getDB();
            const rep = db.envReports.find(r => r.id === reportId);
            if (!rep) return;

            const inputEl = document.getElementById(`reward-amount-${reportId}`);
            const rewardAmount = inputEl ? parseFloat(inputEl.value) : 10;

            if (isNaN(rewardAmount) || rewardAmount < 0) {
                showToast("올바른 보상 마일리지를 입력해 주세요.", "danger");
                return;
            }

            const approveBtn = document.querySelector(`button[onclick="approveEnvReport('${reportId}')"]`);
            if (approveBtn) approveBtn.disabled = true;
            showSpinner("환경 정화 보고서를 승인하는 중입니다...");

            try {
                const emlId = "eml_" + Date.now();
                await fs.runTransaction(async (transaction) => {
                    const reportRef = fs.collection("env_reports").doc(reportId);
                    const studentRef = fs.collection("users").doc(rep.studentId);
                    const emlRef = fs.collection("env_mileage_ledger").doc(emlId);

                    const reportDoc = await transaction.get(reportRef);
                    const studentDoc = await transaction.get(studentRef);

                    if (!reportDoc.exists || reportDoc.data().status !== "pending") {
                        throw new Error("이미 처리된 보고서입니다.");
                    }

                    const studentData = studentDoc.exists ? studentDoc.data() : {};
                    const newMileageBalance = (studentData.mileageBalance || 0) + rewardAmount;
                    const approvedArchive = studentData.approvedArchive || [];
                    
                    // rep 객체 업데이트 버전 만들기
                    const updatedRep = {
                        ...reportDoc.data(),
                        status: "approved",
                        approvedDate: new Date().toISOString(),
                        rewardAmount: rewardAmount
                    };

                    approvedArchive.push(updatedRep);

                    // 1. 학생 데이터 업데이트 (마일리지 점수 및 아카이브)
                    transaction.update(studentRef, {
                        mileageBalance: newMileageBalance,
                        mileage: newMileageBalance,
                        approvedArchive: approvedArchive
                    });

                    // 2. 보고서 상태 업데이트
                    transaction.update(reportRef, {
                        status: "approved",
                        approvedDate: new Date().toISOString(),
                        rewardAmount: rewardAmount
                    });

                    // 3. 마일리지 장부 기록 추가
                    transaction.set(emlRef, {
                        id: emlId,
                        studentId: rep.studentId,
                        studentName: studentData.name || rep.studentName,
                        date: new Date().toISOString(),
                        type: "photo",
                        description: `📷 사진인증 승인: ${rep.activityType || '기타'} (+${rewardAmount}점)`,
                        amount: rewardAmount
                    });
                });

                showToast(`${rep.studentName} 학생의 사진인증을 확인하여 ${rewardAmount} 마일리지를 지급했습니다.`, "success");
            } catch (error) {
                console.error("Error approving env report: ", error);
                showToast("🚫 승인 처리 중 오류가 발생했습니다: " + error.message, "danger");
            } finally {
                if (approveBtn) approveBtn.disabled = false;
                hideSpinner();
            }
        }

        // --- 교사용 승인 완료 보관함 상세 모달 열기/닫기 및 다운로드 ---
        let currentArchiveModalRep = null;

        function openTeacherEnvArchiveModal(repId) {
            const db = getDB();
            const rep = db.envReports.find(r => r.id === repId);
            if (!rep) return;

            currentArchiveModalRep = rep;

            const imgEl = document.getElementById('archive-modal-image');
            const studentEl = document.getElementById('archive-modal-student');
            const dateEl = document.getElementById('archive-modal-date');
            const typeEl = document.getElementById('archive-modal-type');
            const descEl = document.getElementById('archive-modal-desc');
            const rewardEl = document.getElementById('archive-modal-reward');

            if (imgEl) imgEl.src = rep.image || '';
            if (studentEl) studentEl.textContent = rep.studentName;
            if (dateEl) dateEl.textContent = rep.activityDate || new Date(rep.date).toLocaleDateString();
            if (typeEl) typeEl.textContent = rep.activityType || '기타';
            if (descEl) descEl.textContent = rep.desc || '';
            if (rewardEl) rewardEl.textContent = `💚 승인 완료 (+${rep.rewardAmount || 0} 마일리지 지급됨)`;

            const modal = document.getElementById('teacher-env-archive-modal');
            if (modal) modal.style.display = 'flex';
        }

        function closeTeacherEnvArchiveModal() {
            const modal = document.getElementById('teacher-env-archive-modal');
            if (modal) modal.style.display = 'none';
            currentArchiveModalRep = null;
        }

        function downloadArchiveImage() {
            if (!currentArchiveModalRep || !currentArchiveModalRep.image) {
                showToast("다운로드할 사진 데이터가 없습니다.", "danger");
                return;
            }

            const rep = currentArchiveModalRep;
            const link = document.createElement('a');
            link.href = rep.image;
            const cleanName = rep.studentName.replace(/[\/\\?%*:|"<>]/g, "");
            const cleanDate = (rep.activityDate || 'date').replace(/[\/\\?%*:|"<>]/g, "");
            
            link.download = `${cleanName}_${cleanDate}_환경인증.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("📸 사진이 성공적으로 다운로드되었습니다.", "success");
        }

        // --- 학생용 환경인증 이력 및 실천 정산 렌더링 ---
        function renderStudentEnvTab(db) {
            // 보유 마일리지 실시간 동기화
            const student = db.students.find(s => s.id === currentUser.id);
            const mileage = student ? (student.mileageBalance || 0) : 0;
            document.getElementById('student-env-mileage-val').innerText = mileage;

            // 활동 유형 셀렉트박스 채우기
            const actSelect = document.getElementById('env-activity-type');
            if (actSelect) {
                const oldVal = actSelect.value;
                actSelect.innerHTML = "";
                db.envActivityTypes.forEach(act => {
                    const opt = document.createElement('option');
                    opt.value = act.name;
                    opt.innerText = `${act.name} (권장 보상: ${act.reward} 마일리지)`;
                    opt.dataset.guide = act.guide || '';
                    actSelect.appendChild(opt);
                });
                if (oldVal && db.envActivityTypes.some(act => act.name === oldVal)) {
                    actSelect.value = oldVal;
                }
                // 가이드 표시 함수
                const showGuide = () => {
                    const selected = actSelect.options[actSelect.selectedIndex];
                    const guideBox = document.getElementById('env-activity-guide-box');
                    const guideText = selected ? (selected.dataset.guide || '') : '';
                    if (guideBox) {
                        if (guideText) {
                            guideBox.style.display = 'block';
                            guideBox.innerText = '📋 ' + guideText;
                        } else {
                            guideBox.style.display = 'none';
                        }
                    }
                };
                actSelect.onchange = showGuide;
                showGuide(); // 초기 표시
            }

            // 환전 버튼 및 섹션 제어
            const exchangeBtn = document.getElementById('btn-env-exchange');
            const settings = db.systemSettings || {};
            const isExchangeActive = settings.envExchangeActive !== false;

            if (exchangeBtn) {
                if (!isExchangeActive) {
                    exchangeBtn.disabled = true;
                    exchangeBtn.innerText = "🚫 환전 기능 비활성화됨";
                    exchangeBtn.style.opacity = "0.6";
                } else if (mileage < 10) {
                    exchangeBtn.disabled = true;
                    exchangeBtn.innerText = "💵 치킨으로 환전하기 (최소 10점 필요)";
                    exchangeBtn.style.opacity = "0.6";
                } else {
                    exchangeBtn.disabled = false;
                    exchangeBtn.innerText = "💵 치킨으로 환전하기 (10점 ➡️ 1치킨)";
                    exchangeBtn.style.opacity = "1";
                }
            }

            // 가이드 텍스트 및 이미지 로드
            const guideTextEl = document.getElementById('env-student-guide-text');
            const guideImgEl = document.getElementById('env-student-guide-image');
            const guideImgContainer = document.getElementById('env-student-guide-image-container');

            if (guideTextEl) {
                guideTextEl.innerText = settings.envExampleText || "예시: 급식판을 깨끗이 비우고 사진을 찍어 올려주세요!";
            }
            if (guideImgEl && guideImgContainer) {
                if (settings.envExampleImage) {
                    guideImgEl.src = settings.envExampleImage;
                    guideImgContainer.style.display = "block";
                } else {
                    guideImgEl.src = "";
                    guideImgContainer.style.display = "none";
                }
            }

            // 1. 나의 일일 정산 내역
            const attTbody = document.getElementById('student-env-attendance-tbody');
            if (attTbody) {
                attTbody.innerHTML = "";
                const myAtts = db.monthlyAttendance
                    .filter(att => att.studentId === currentUser.id)
                    .sort((a,b) => new Date(b.date) - new Date(a.date));

                if (myAtts.length === 0) {
                    attTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">실천 정산 내역 없음</td></tr>`;
                } else {
                    myAtts.forEach(att => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${att.date}</td>
                            <td style="text-align:center;">${att.plate ? '🍽️ O' : 'X'}</td>
                            <td style="text-align:center;">${att.handkerchief ? '🧼 O' : 'X'}</td>
                            <td style="font-weight:bold; color:#2b8a3e;">+${att.amount} 마일리지</td>
                        `;
                        attTbody.appendChild(tr);
                    });
                }
            }

            // 2. 나의 최근 사진 인증 이력
            const repTbody = document.getElementById('student-env-reports-tbody');
            if (repTbody) {
                repTbody.innerHTML = "";
                const myPendings = db.envReports.filter(r => r.studentId === currentUser.id && r.status === 'pending');
                
                if (myPendings.length === 0) {
                    repTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">심사 대기 중인 인증서 없음</td></tr>`;
                } else {
                    myPendings.forEach(rep => {
                        const tr = document.createElement('tr');
                        const rDate = new Date(rep.date).toLocaleDateString();
                        tr.innerHTML = `
                            <td>${rDate}</td>
                            <td>${rep.desc}</td>
                            <td><span class="badge" style="background:#fff3bf; color:#d9480f; padding:2px 6px; border-radius:6px; font-size:0.75rem; font-weight:bold;">⏳ 심사 중</span></td>
                        `;
                        repTbody.appendChild(tr);
                    });
                }
            }

            // 3. 나의 전체 사진 인증 보고서 이력
            const allTbody = document.getElementById('student-env-reports-all-tbody');
            if (allTbody) {
                allTbody.innerHTML = "";
                const myAllReports = db.envReports
                    .filter(r => r.studentId === currentUser.id)
                    .sort((a,b) => new Date(b.date) - new Date(a.date));

                if (myAllReports.length === 0) {
                    allTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); font-size:0.9rem;">제출된 인증 보고서 이력이 없습니다.</td></tr>`;
                } else {
                    myAllReports.forEach(rep => {
                        const tr = document.createElement('tr');
                        const rDate = new Date(rep.date).toLocaleDateString();
                        let statusHTML = "";
                        let rewardText = "-";
                        
                        if (rep.status === "pending") {
                            statusHTML = `<span class="badge" style="background:#fff3bf; color:#d9480f; padding:4px 8px; border-radius:6px; font-size:0.8rem; font-weight:bold;">⏳ 심사 대기</span>`;
                        } else if (rep.status === "approved") {
                            statusHTML = `<span class="badge" style="background:#e2f9e1; color:#2b8a3e; padding:4px 8px; border-radius:6px; font-size:0.8rem; font-weight:bold;">💚 승인 완료</span>`;
                            rewardText = `+${rep.rewardAmount} 마일리지`;
                        } else {
                            statusHTML = `<span class="badge" style="background:#ffe5e5; color:#c92a2a; padding:4px 8px; border-radius:6px; font-size:0.8rem; font-weight:bold;">❌ 반려됨</span>`;
                        }

                        tr.innerHTML = `
                            <td>${rDate}</td>
                            <td><strong>${rep.activityType || '기타'}</strong></td>
                            <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${rep.desc}">${rep.desc}</td>
                            <td>${statusHTML}</td>
                            <td style="font-weight:bold; color:#0b7285;">${rewardText}</td>
                        `;
                        });
                }
            }

            // 4. 학생 환경 담당자 일별 정산 패널 활성화
            const isManager = student && (student.isHandkerchiefManager || student.isMealManager);
            const managerCard = document.getElementById('student-env-manager-card');
            if (managerCard) {
                if (isManager) {
                    managerCard.style.display = 'block';
                    renderStudentEnvManagerPanel(db, student);
                } else {
                    managerCard.style.display = 'none';
                }
            }

            // 마일리지 상세 장부 펼침 상태 시 자동 새로고침 동기화
            const historyCard = document.getElementById('student-mileage-history-card');
            if (historyCard && historyCard.style.display === 'block') {
                renderStudentMileageHistory();
            }
        }

        // --- 학생 주도 일별 환경 실천 출석 정산 렌더링 및 기능 ---
        function renderStudentEnvManagerPanel(db, currentUserStudent) {
            const datePicker = document.getElementById('student-env-date-picker');
            let selectedDate = new Date().toISOString().split('T')[0];
            
            if (datePicker) {
                if (!datePicker.value) {
                    datePicker.value = selectedDate;
                } else {
                    selectedDate = datePicker.value;
                }
                
                // 날짜 변경 시 갱신 이벤트 바인딩 (이전 핸들러 덮어쓰기)
                datePicker.onchange = () => {
                    const freshDB = getDB();
                    const freshStudent = freshDB.students.find(s => s.id === currentUser.id);
                    renderStudentEnvManagerPanel(freshDB, freshStudent);
                };
            }

            const isHandkerchief = currentUserStudent.isHandkerchiefManager;
            const isMeal = currentUserStudent.isMealManager;

            // 전체 선택 체크박스 초기화
            const allChk = document.getElementById('student-env-check-all');
            if (allChk) allChk.checked = false;

            // 테이블 렌더링
            const tbody = document.getElementById('student-env-manager-tbody');
            if (tbody) {
                tbody.innerHTML = "";
                
                // 이미 해당 날짜로 정산 완료되었는지 체크 (분야별)
                const isMealSettled = db.monthlyAttendance.some(att => att.date === selectedDate && (att.plate === true || att.studentId === "system_dummy_meal"));
                const isHandkerchiefSettled = db.monthlyAttendance.some(att => att.date === selectedDate && (att.handkerchief === true || att.studentId === "system_dummy_hand"));

                // 이 로그인 사용자가 정산할 수 있는 항목이 모두 완료되었는지
                let isAlreadySettledForUser = false;
                if (isMeal && isHandkerchief) {
                    isAlreadySettledForUser = isMealSettled && isHandkerchiefSettled;
                } else if (isMeal) {
                    isAlreadySettledForUser = isMealSettled;
                } else if (isHandkerchief) {
                    isAlreadySettledForUser = isHandkerchiefSettled;
                }

                db.students.filter(s => s.role !== 'teacher').forEach(st => {
                    const tr = document.createElement('tr');
                    
                    const existingSettle = db.monthlyAttendance.find(att => att.date === selectedDate && att.studentId === st.id);
                    const plateChecked = existingSettle ? existingSettle.plate : false;
                    const handkerchiefChecked = existingSettle ? existingSettle.handkerchief : false;

                    const plateDisabled = !isMeal || isMealSettled;
                    const handDisabled = !isHandkerchief || isHandkerchiefSettled;

                    tr.innerHTML = `
                        <td style="text-align:center;">
                            <input type="checkbox" class="student-row-select" style="transform:scale(1.2); cursor:pointer;" onchange="syncStudentAllCheckState()" ${isAlreadySettledForUser ? 'disabled' : ''}>
                        </td>
                        <td><strong>${st.name} (${st.id})</strong></td>
                        <td style="text-align: center;">
                            <input type="checkbox" class="student-chk-plate" data-student-id="${st.id}" ${plateChecked ? 'checked' : ''} ${plateDisabled ? 'disabled' : ''} style="transform: scale(1.3); cursor: pointer;">
                        </td>
                        <td style="text-align: center;">
                            <input type="checkbox" class="student-chk-handkerchief" data-student-id="${st.id}" ${handkerchiefChecked ? 'checked' : ''} ${handDisabled ? 'disabled' : ''} style="transform: scale(1.3); cursor: pointer;">
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                // 정산 버튼 잠금
                const settleBtn = document.getElementById('btn-student-env-settle');
                if (settleBtn) {
                    if (isAlreadySettledForUser) {
                        settleBtn.disabled = true;
                        settleBtn.innerText = "🚫 선택 날짜 정산 완료";
                        settleBtn.style.opacity = "0.6";
                    } else {
                        settleBtn.disabled = false;
                        settleBtn.innerText = "실천 일괄 정산 실행";
                        settleBtn.style.opacity = "1";
                    }
                }
            }
        }

        function toggleAllStudentEnvChecks(checked) {
            const db = getDB();
            const student = db.students.find(s => s.id === currentUser.id);
            if (!student) return;

            const isHandkerchief = student.isHandkerchiefManager;
            const isMeal = student.isMealManager;

            document.querySelectorAll('.student-row-select').forEach(el => {
                if (!el.disabled) el.checked = checked;
            });
            document.querySelectorAll('.student-chk-plate').forEach(el => {
                if (!el.disabled && isMeal) el.checked = checked;
            });
            document.querySelectorAll('.student-chk-handkerchief').forEach(el => {
                if (!el.disabled && isHandkerchief) el.checked = checked;
            });
        }

        function syncStudentAllCheckState() {
            const rows = document.querySelectorAll('.student-row-select:not(:disabled)');
            const allChk = document.getElementById('student-env-check-all');
            if (!allChk || rows.length === 0) return;
            const allChecked = [...rows].every(el => el.checked);
            allChk.checked = allChecked;

            const db = getDB();
            const student = db.students.find(s => s.id === currentUser.id);
            if (!student) return;
            const isHandkerchief = student.isHandkerchiefManager;
            const isMeal = student.isMealManager;

            rows.forEach(rowChk => {
                const tr = rowChk.closest('tr');
                if (tr) {
                    const plate = tr.querySelector('.student-chk-plate');
                    const hand  = tr.querySelector('.student-chk-handkerchief');
                    if (plate && !plate.disabled && isMeal) plate.checked = rowChk.checked;
                    if (hand && !hand.disabled && isHandkerchief) hand.checked  = rowChk.checked;
                }
            });
        }

        function handleStudentDailyEnvRewards() {
            const db = getDB();
            const student = db.students.find(s => s.id === currentUser.id);
            if (!student) return;

            const isHandkerchief = student.isHandkerchiefManager;
            const isMeal = student.isMealManager;
            if (!isHandkerchief && !isMeal) {
                showToast("정산 권한이 없습니다.", "danger");
                return;
            }

            const datePicker = document.getElementById('student-env-date-picker');
            const selectedDate = datePicker ? datePicker.value : new Date().toISOString().split('T')[0];

            // 이미 해당 날짜로 정산 완료되었는지 체크 (분야별)
            const isMealSettled = db.monthlyAttendance.some(att => att.date === selectedDate && (att.plate === true || att.studentId === "system_dummy_meal"));
            const isHandkerchiefSettled = db.monthlyAttendance.some(att => att.date === selectedDate && (att.handkerchief === true || att.studentId === "system_dummy_hand"));

            if (isMeal && isMealSettled) {
                showToast("선택한 날짜의 급식 정산은 이미 완료되었습니다.", "danger");
                return;
            }
            if (isHandkerchief && isHandkerchiefSettled) {
                showToast("선택한 날짜의 손수건 정산은 이미 완료되었습니다.", "danger");
                return;
            }

            if (!confirm(`📅 ${selectedDate} 일자 실천 정산을 진행하시겠습니까?\n정산 완료 후에는 수정할 수 없습니다.`)) return;

            const plateReward = (db.envSettings && db.envSettings.plateReward) !== undefined ? db.envSettings.plateReward : 5;
            const handkerchiefReward = (db.envSettings && db.envSettings.handkerchiefReward) !== undefined ? db.envSettings.handkerchiefReward : 3;

            let rewardedCount = 0;
            let totalDistributed = 0;
            const newRecords = [];

            db.students.filter(s => s.role !== 'teacher').forEach(st => {
                const plateInput = document.querySelector(`.student-chk-plate[data-student-id="${st.id}"]`);
                const handInput = document.querySelector(`.student-chk-handkerchief[data-student-id="${st.id}"]`);

                const plateChecked = (isMeal && plateInput) ? plateInput.checked : false;
                const handChecked = (isHandkerchief && handInput) ? handInput.checked : false;

                if (plateChecked || handChecked) {
                    let reward = 0;
                    const descParts = [];
                    if (plateChecked) {
                        reward += plateReward;
                        descParts.push(`잔반 Zero (+${plateReward}점)`);
                    }
                    if (handChecked) {
                        reward += handkerchiefReward;
                        descParts.push(`손수건 사용 (+${handkerchiefReward}점)`);
                    }

                    if (reward > 0) {
                        const targetStudent = db.students.find(x => x.id === st.id);
                        if (targetStudent) {
                            targetStudent.mileageBalance = (targetStudent.mileageBalance || 0) + reward;
                            targetStudent.mileage = targetStudent.mileageBalance;
                            rewardedCount++;
                            totalDistributed += reward;

                            // 해당 날짜에 이 학생의 기존 정산 기록이 있는지 체크
                            let existingRecord = db.monthlyAttendance.find(att => att.date === selectedDate && att.studentId === st.id);
                            if (existingRecord) {
                                if (plateChecked) existingRecord.plate = true;
                                if (handChecked) existingRecord.handkerchief = true;
                                existingRecord.amount = (existingRecord.amount || 0) + reward;
                            } else {
                                newRecords.push({
                                    date: selectedDate,
                                    studentId: st.id,
                                    plate: plateChecked,
                                    handkerchief: handChecked,
                                    amount: reward
                                });
                            }

                            if (!Array.isArray(db.envMileageLedger)) db.envMileageLedger = [];
                            db.envMileageLedger.push({
                                id: "eml_" + Date.now() + "_" + st.id,
                                studentId: st.id,
                                studentName: targetStudent.name,
                                date: selectedDate + "T00:00:00.000Z",
                                type: "attendance",
                                description: `🍽️ 출석 정산: ${descParts.join(', ')}`,
                                amount: reward
                            });
                        }
                    }
                }
            });

            if (isMeal) {
                newRecords.push({
                    date: selectedDate,
                    studentId: "system_dummy_meal",
                    plate: false,
                    handkerchief: false,
                    amount: 0
                });
            }
            if (isHandkerchief) {
                newRecords.push({
                    date: selectedDate,
                    studentId: "system_dummy_hand",
                    plate: false,
                    handkerchief: false,
                    amount: 0
                });
            }

            db.monthlyAttendance.push(...newRecords);
            
            const allChk = document.getElementById('student-env-check-all');
            if (allChk) allChk.checked = false;

            saveDB(db);
            showToast(`🌿 ${selectedDate} 일자 정산 완료! (${rewardedCount}명 마일리지 지급)`, "success");
            loadTabData("environment");
        }

        // --- 마일리지 환전 로직 ---
        async function handleExchangeMileage() {
            const db = getDB();
            const student = db.students.find(s => s.id === currentUser.id);
            if (!student) return;

            const mileage = student.mileageBalance || 0;

            if (mileage < 10) {
                alert("환전 가능한 마일리지가 적습니다. (최소 10 마일리지 필요)");
                showToast("환전 가능한 마일리지가 적습니다. (최소 10 마일리지 필요)", "danger");
                return;
            }

            const settings = db.systemSettings || {};
            const isExchangeActive = settings.envExchangeActive !== false;

            if (!isExchangeActive) {
                showToast("환전 가능 시간이 아닙니다.", "danger");
                return;
            }

            // prompt로 입력받기
            const maxExchange = Math.floor(mileage / 10) * 10;
            const inputVal = prompt(`환전할 마일리지 점수를 입력해 주세요. (10점 ➡️ 10치킨 환전)\n최대 환전 가능 점수: ${maxExchange}점\n(10점 미만 단위는 환전이 불가능합니다)`, maxExchange.toString());
            
            if (inputVal === null) return; // 취소
            
            const exchangeAmount = parseInt(inputVal);
            if (isNaN(exchangeAmount) || exchangeAmount < 10 || exchangeAmount % 10 !== 0) {
                showToast("환전 가능한 마일리지가 적습니다.", "danger");
                return;
            }

            if (exchangeAmount > mileage) {
                showToast(`보유 마일리지(${mileage}점)보다 많은 마일리지를 환전할 수 없습니다.`, "danger");
                return;
            }

            const chickenReward = exchangeAmount; // 1:1 비율 (10점 -> 10치킨)

            const exchangeBtn = document.querySelector("#tab-environment button[onclick='handleExchangeMileage()']");
            if (exchangeBtn) exchangeBtn.disabled = true;
            showSpinner("마일리지 환전을 처리하고 있습니다...");

            try {
                const txId = "tx_env_exch_" + Date.now();
                const emlId = "eml_exch_" + Date.now();

                // Firestore batch 활용하여 여러 문서 한번에 업데이트
                const batch = fs.batch();

                // 1. 학생 지갑 및 마일리지 차감
                const studentRef = fs.collection("users").doc(student.id);
                batch.update(studentRef, {
                    mileageBalance: mileage - exchangeAmount,
                    mileage: mileage - exchangeAmount,
                    balance: (student.balance || 0) + chickenReward
                });

                // 2. 거래내역 추가
                const txRef = fs.collection("transactions").doc(txId);
                batch.set(txRef, {
                    id: txId,
                    studentId: student.id,
                    date: new Date().toISOString(),
                    description: `🌿 환경 마일리지 환전 (${exchangeAmount}점 ➡️ ${chickenReward}치킨 환전)`,
                    type: "deposit",
                    amount: chickenReward,
                    balanceAfter: (student.balance || 0) + chickenReward,
                    isSavingsMaturity: false
                });

                // 3. 마일리지 장부 기록 추가 (환전 차감)
                const emlRef = fs.collection("env_mileage_ledger").doc(emlId);
                batch.set(emlRef, {
                    id: emlId,
                    studentId: student.id,
                    studentName: student.name,
                    date: new Date().toISOString(),
                    type: "exchange",
                    description: `💵 치킨 환전 (${exchangeAmount}점 ➡️ ${chickenReward}치킨)`,
                    amount: -exchangeAmount
                });

                await batch.commit();

                // 로컬 currentUser 동기화
                currentUser.mileage = mileage - exchangeAmount;
                currentUser.mileageBalance = mileage - exchangeAmount;
                currentUser.balance = (student.balance || 0) + chickenReward;

                showToast(`💵 ${exchangeAmount} 마일리지를 ${chickenReward} 치킨으로 성공적으로 환전했습니다!`, "success");
            } catch (error) {
                console.error("Error exchanging mileage: ", error);
                showToast("🚫 환전 처리 중 오류가 발생했습니다. 다시 시도해 주세요.", "danger");
            } finally {
                if (exchangeBtn) exchangeBtn.disabled = false;
                hideSpinner();
            }
        }

        // --- 학생용 마일리지 장부 내역 토글 및 렌더링 ---
        function toggleMileageHistory() {
            const card = document.getElementById('student-mileage-history-card');
            if (card) {
                if (card.style.display === 'none') {
                    card.style.display = 'block';
                    const today = new Date();
                    const oneMonthAgo = new Date();
                    oneMonthAgo.setMonth(today.getMonth() - 1);
                    
                    const startInput = document.getElementById('mileage-filter-start');
                    const endInput = document.getElementById('mileage-filter-end');
                    
                    if (startInput && !startInput.value) {
                        startInput.value = oneMonthAgo.toISOString().split('T')[0];
                    }
                    if (endInput && !endInput.value) {
                        endInput.value = today.toISOString().split('T')[0];
                    }
                    
                    renderStudentMileageHistory();
                } else {
                    card.style.display = 'none';
                }
            }
        }

        function clearMileageFilter() {
            const startInput = document.getElementById('mileage-filter-start');
            const endInput = document.getElementById('mileage-filter-end');
            if (startInput) startInput.value = "";
            if (endInput) endInput.value = "";
            renderStudentMileageHistory();
        }

        function renderStudentMileageHistory() {
            const db = getDB();
            const tbody = document.getElementById('student-mileage-history-tbody');
            if (!tbody) return;

            tbody.innerHTML = "";

            const startVal = document.getElementById('mileage-filter-start').value;
            const endVal = document.getElementById('mileage-filter-end').value;

            let history = (db.envMileageLedger || []).filter(item => item.studentId === currentUser.id);

            if (startVal) {
                const startDate = new Date(startVal + "T00:00:00");
                history = history.filter(item => new Date(item.date) >= startDate);
            }
            if (endVal) {
                const endDate = new Date(endVal + "T23:59:59");
                history = history.filter(item => new Date(item.date) <= endDate);
            }

            history.sort((a, b) => new Date(b.date) - new Date(a.date));

            if (history.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">해당 기간의 마일리지 변동 내역이 없습니다.</td></tr>`;
                return;
            }

            history.forEach(item => {
                const tr = document.createElement('tr');
                const dateStr = new Date(item.date).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                let typeBadge = "";
                if (item.type === "attendance") {
                    typeBadge = `<span class="badge" style="background:#e2f9e1; color:#2b8a3e; padding:2px 6px; border-radius:6px; font-size:0.75rem; font-weight:bold;">🌿 정산</span>`;
                } else if (item.type === "report") {
                    typeBadge = `<span class="badge" style="background:#e3fafc; color:#0b7285; padding:2px 6px; border-radius:6px; font-size:0.75rem; font-weight:bold;">📸 인증</span>`;
                } else if (item.type === "exchange") {
                    typeBadge = `<span class="badge" style="background:#fff3bf; color:#d9480f; padding:2px 6px; border-radius:6px; font-size:0.75rem; font-weight:bold;">💵 환전</span>`;
                } else {
                    typeBadge = `<span class="badge" style="background:#f1f3f5; color:#495057; padding:2px 6px; border-radius:6px; font-size:0.75rem; font-weight:bold;">기타</span>`;
                }

                const amountText = item.amount > 0 ? `+${item.amount}` : `${item.amount}`;
                const amountColor = item.amount > 0 ? "#2b8a3e" : "#c92a2a";

                tr.innerHTML = `
                    <td style="font-size:0.8rem; white-space:nowrap;">${dateStr}</td>
                    <td>${typeBadge}</td>
                    <td style="font-size:0.85rem;">${item.description || '-'}</td>
                    <td style="font-weight:bold; color:${amountColor}; text-align:right; font-size:0.85rem; padding-right:15px;">${amountText} 점</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // ✅ 환경 출석 전체 선택/해제 함수 (2-4)
        function toggleAllEnvChecks(checked) {
            document.querySelectorAll('.env-row-select').forEach(el => el.checked = checked);
            document.querySelectorAll('.env-chk-plate').forEach(el => el.checked = checked);
            document.querySelectorAll('.env-chk-handkerchief').forEach(el => el.checked = checked);
        }

        // 개별 행 체크 변경 시 전체선택 체크박스 상태 동기화
        function syncAllCheckState() {
            const rows = document.querySelectorAll('.env-row-select');
            const allChk = document.getElementById('env-check-all');
            if (!allChk || rows.length === 0) return;
            const allChecked = [...rows].every(el => el.checked);
            allChk.checked = allChecked;
            // 행 선택 체크박스 변경 시 해당 카드의 plate/handkerchief도 동기화
            rows.forEach(rowChk => {
                const card = rowChk.closest('.teacher-env-card');
                if (card) {
                    const plate = card.querySelector('.env-chk-plate');
                    const hand  = card.querySelector('.env-chk-handkerchief');
                    if (plate) plate.checked = rowChk.checked;
                    if (hand)  hand.checked  = rowChk.checked;
                }
            });
        }

        // ✅ 교사 환경 탭 환전 토글 핸들러 (2-2) — systemSettings.envExchangeActive 동기화
        function handleEnvExchangeToggle(isChecked) {
            const db = getDB();
            db.systemSettings.envExchangeActive = isChecked;
            saveDB(db);
            // 시스템 설정 탭의 토글도 동기화
            const sysToggle = document.getElementById('toggle-env-exchange-active');
            if (sysToggle) sysToggle.checked = isChecked;
            showToast(isChecked ? '💵 환전 기능이 활성화되었습니다.' : '🚫 환전 기능이 비활성화되었습니다.', isChecked ? 'success' : 'warning');
            loadTabData('environment');
        }

        // ✅ 승인 완료 보관함 아코디언 토글 (2-5)
        function toggleEnvArchive() {
            const container = document.getElementById('env-archive-container');
            const btn = document.getElementById('btn-toggle-archive');
            if (!container) return;
            const isHidden = container.style.display === 'none';
            container.style.display = isHidden ? 'block' : 'none';
            if (btn) btn.textContent = isHidden ? '▲ 접기' : '▼ 펼치기';
        }

        // --- 활동 유형 CRUD 로직 ---
        let editingEnvActId = null;

        function renderEnvActivityTypes(db) {
            const tbody = document.getElementById('teacher-env-act-tbody');
            if (!tbody) return;
            tbody.innerHTML = "";

            if (!db.envActivityTypes || db.envActivityTypes.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">등록된 환경 활동 유형이 없습니다.</td></tr>`;
                return;
            }

            db.envActivityTypes.forEach(act => {
                const tr = document.createElement('tr');
                const guideText = act.guide ? act.guide.substring(0, 40) + (act.guide.length > 40 ? '...' : '') : '<span style="color:var(--text-muted); font-size:0.8rem;">설명 없음</span>';
                tr.innerHTML = `
                    <td><strong>${act.name}</strong></td>
                    <td style="font-weight:bold; color:#0b7285;">${act.reward} 마일리지</td>
                    <td style="font-size:0.82rem; color:#495057;">${guideText}</td>
                    <td>
                        <button class="btn btn-primary" onclick="handleEditEnvActivityType('${act.id}')" style="padding: 4px 8px; font-size: 0.8rem;">수정</button>
                        <button class="btn btn-danger" onclick="handleDeleteEnvActivityType('${act.id}')" style="padding: 4px 8px; font-size: 0.8rem;">삭제</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function handleSaveEnvActivityType() {
            const name = document.getElementById('env-act-name').value.trim();
            const reward = parseInt(document.getElementById('env-act-reward').value);
            const guide = (document.getElementById('env-act-guide') || {}).value ? document.getElementById('env-act-guide').value.trim() : '';

            if (!name) {
                showToast("활동 유형명을 입력해 주세요.", "danger");
                return;
            }
            if (isNaN(reward) || reward < 0) {
                showToast("올바른 보상 마일리지를 입력해 주세요.", "danger");
                return;
            }

            const db = getDB();

            if (editingEnvActId) {
                const idx = db.envActivityTypes.findIndex(act => act.id === editingEnvActId);
                if (idx > -1) {
                    db.envActivityTypes[idx].name = name;
                    db.envActivityTypes[idx].reward = reward;
                    db.envActivityTypes[idx].guide = guide;
                    showToast("🌿 환경 활동 유형이 수정되었습니다.", "success");
                }
            } else {
                const isDup = db.envActivityTypes.some(act => act.name === name);
                if (isDup) {
                    showToast("이미 존재하는 활동 유형명입니다.", "danger");
                    return;
                }
                db.envActivityTypes.push({
                    id: "act_" + Date.now(),
                    name: name,
                    reward: reward,
                    guide: guide
                });
                showToast("🌿 새 환경 활동 유형이 추가되었습니다.", "success");
            }

            saveDB(db);
            handleResetEnvActivityForm();
            loadTabData("environment");
        }

        function handleEditEnvActivityType(id) {
            const db = getDB();
            const act = db.envActivityTypes.find(a => a.id === id);
            if (!act) return;

            document.getElementById('env-act-name').value = act.name;
            document.getElementById('env-act-reward').value = act.reward;
            const guideEl = document.getElementById('env-act-guide');
            if (guideEl) guideEl.value = act.guide || '';
            editingEnvActId = id;

            document.getElementById('btn-env-act-reset').style.display = "inline-flex";
        }

        function handleDeleteEnvActivityType(id) {
            if (!confirm("정말 이 환경 활동 유형을 삭제하시겠습니까?")) return;

            const db = getDB();
            db.envActivityTypes = db.envActivityTypes.filter(act => act.id !== id);
            
            saveDB(db);
            showToast("🗑️ 환경 활동 유형이 삭제되었습니다.", "info");
            handleResetEnvActivityForm();
            loadTabData("environment");
        }

        function handleResetEnvActivityForm() {
            document.getElementById('env-act-name').value = "";
            document.getElementById('env-act-reward').value = "";
            const guideEl = document.getElementById('env-act-guide');
            if (guideEl) guideEl.value = '';
            editingEnvActId = null;
            document.getElementById('btn-env-act-reset').style.display = "none";
        }

        // --- 학생별 누적 마일리지 통계 표 렌더링 + 교사 위젯 업데이트 ---
        function renderEnvStatistics(db) {
            const tbody = document.getElementById('teacher-env-statistics-tbody');
            if (tbody) {
                tbody.innerHTML = "";
                const students = db.students.filter(s => s.role !== 'teacher');

                if (students.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">등록된 학생이 없습니다.</td></tr>`;
                } else {
                    students.forEach(st => {
                        const tr = document.createElement('tr');
                        const mileage = st.mileageBalance || 0;
                        tr.innerHTML = `
                            <td><code>${st.id}</code></td>
                            <td><strong>${st.name}</strong></td>
                            <td style="font-weight:bold; color:#0b7285;">${mileage} 점</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }

            // 교사용 환경 마일리지 총합 위젯 업데이트
            const allStudents = db.students.filter(s => s.role !== 'teacher');
            const totalMileage = allStudents.reduce((sum, st) => sum + (st.mileageBalance || 0), 0);
            const participants = allStudents.filter(st => (st.mileageBalance || 0) > 0).length;
            const avg = allStudents.length > 0 ? Math.round(totalMileage / allStudents.length) : 0;

            const totalEl = document.getElementById('teacher-env-total-mileage');
            const countEl = document.getElementById('teacher-env-participant-count');
            const avgEl = document.getElementById('teacher-env-avg-mileage');
            if (totalEl) totalEl.textContent = totalMileage.toLocaleString();
            if (countEl) countEl.textContent = participants + '명';
            if (avgEl) avgEl.textContent = avg + '점';
        }

        // 환경 마일리지 상세 모달 열기
        function openEnvMileageDetailModal() {
            const db = getDB();
            const modal = document.getElementById('env-mileage-detail-modal');
            if (!modal) return;

            // 요약 카드
            const summaryEl = document.getElementById('env-mileage-detail-summary');
            const allStudents = db.students.filter(s => s.role !== 'teacher');
            const total = allStudents.reduce((sum, st) => sum + (st.mileageBalance || 0), 0);
            const avg = allStudents.length > 0 ? Math.round(total / allStudents.length) : 0;
            if (summaryEl) {
                summaryEl.innerHTML = [
                    { label: '총합', value: total + '점', color: '#0b7285' },
                    { label: '학생 수', value: allStudents.length + '명', color: '#2b8a3e' },
                    { label: '평균', value: avg + '점', color: '#d9480f' }
                ].map(s => `<div style="flex:1; min-width:120px; background:#f8f9fa; border-radius:10px; padding:12px; text-align:center;">
                    <div style="font-size:0.8rem; color:var(--text-muted);">${s.label}</div>
                    <div style="font-size:1.5rem; font-weight:bold; color:${s.color};">${s.value}</div>
                </div>`).join('');
            }

            // 상세 테이블
            const tbody = document.getElementById('env-mileage-detail-tbody');
            if (tbody) {
                tbody.innerHTML = '';
                const sorted = [...allStudents].sort((a, b) => (b.mileageBalance || 0) - (a.mileageBalance || 0));
                sorted.forEach(st => {
                    const mileage = st.mileageBalance || 0;
                    const activities = (db.envActivities || []).filter(a => a.studentId === st.id);
                    const lastDate = activities.length > 0 ?
                        new Date(activities[activities.length - 1].date).toLocaleDateString('ko-KR') : '-';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${st.name}</strong> <span style="font-size:0.8rem; color:var(--text-muted);">(${st.id})</span></td>
                        <td style="font-weight:bold; color:#0b7285; font-size:1.1rem;">${mileage.toLocaleString()} 점</td>
                        <td>${activities.length}회</td>
                        <td style="font-size:0.85rem;">${lastDate}</td>
                    `;
                    tbody.appendChild(tr);
                });
                if (sorted.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">마일리지 적립 내역이 없습니다.</td></tr>';
                }
            }

            modal.style.display = 'flex';
        }

        function closeEnvMileageDetailModal() {
            const modal = document.getElementById('env-mileage-detail-modal');
            if (modal) modal.style.display = 'none';
        }

        // ==========================================
        // 7. TAB 5: TAX & GOALS LOGIC
        // ==========================================
        function updateTaxVaultCard(db) {
            const taxTotal = db.tax.totalTax;
            document.querySelectorAll('.tax-vault-total-val').forEach(el => {
                el.innerText = taxTotal.toLocaleString();
            });

            // 현재 진행 중인 목표 찾기 (달성률 100% 미만인 첫 번째 목표)
            const currentGoal = db.taxGoals.find(g => taxTotal < g.targetAmount) || db.taxGoals[db.taxGoals.length - 1];
            const goalText = currentGoal ? `${currentGoal.description} (${currentGoal.targetAmount.toLocaleString()} ${getCurrencyName()})` : "모든 목표 달성!";
            document.querySelectorAll('.tax-vault-active-goal').forEach(el => {
                el.innerText = goalText;
            });
        }

        function renderTax() {
            const db = getDB();
            updateTaxVaultCard(db);

            const taxTotal = db.tax.totalTax;
            document.getElementById('tax-total-val').innerText = taxTotal.toLocaleString();

            const goalListDiv = document.getElementById('tax-goal-list');
            goalListDiv.innerHTML = "";

            if (db.taxGoals.length === 0) {
                goalListDiv.innerHTML = `<p style="font-size: 0.9rem; color: var(--text-muted);">목표가 설정되어 있지 않습니다.</p>`;
            } else {
                const mainGoal = db.taxGoals[0];
                document.getElementById('tax-target-val').innerText = mainGoal.targetAmount.toLocaleString();
                
                const percent = Math.min(100, Math.round((taxTotal / mainGoal.targetAmount) * 100));
                
                document.getElementById('tax-percent-text').textContent = `${percent}%`;
                document.getElementById('tax-circle-fill').setAttribute('stroke-dasharray', `${percent}, 100`);
                document.getElementById('tax-progress-fill').style.width = `${percent}%`;

                db.taxGoals.forEach((goal, idx) => {
                    const pct = Math.min(100, Math.round((taxTotal / goal.targetAmount) * 100));
                    const item = document.createElement('div');
                    item.style.padding = "15px";
                    item.style.borderRadius = "12px";
                    item.style.border = "1px solid var(--border-color)";
                    item.style.background = pct >= 100 ? "#e8f8f5" : "#fafafa";

                    item.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">
                            <strong style="${pct >= 100 ? 'color:#2ecc71;' : ''}">${idx+1}. ${goal.description}</strong>
                            <span style="font-weight:bold; color:var(--text-main);">${pct}% 달성</span>
                        </div>
                        <div style="font-size: 0.8rem; color:var(--text-muted);">
                            목표액: ${goal.targetAmount.toLocaleString()} ${getCurrencyName()} (현재 잔여: ${Math.max(0, goal.targetAmount - taxTotal).toLocaleString()} ${getCurrencyName()})
                        </div>
                        <div class="tax-progress-bar" style="height: 10px; margin-top:8px;">
                            <div class="tax-progress-fill" style="width: ${pct}%; background: ${pct >= 100 ? '#2ecc71' : 'var(--primary)'}"></div>
                        </div>
                    `;
                    goalListDiv.appendChild(item);
                });
            }

            // 학생용 세입/세출 세금 장부 렌더링
            const ledgerTbody = document.getElementById('student-tax-ledger-tbody');
            if (ledgerTbody) {
                ledgerTbody.innerHTML = "";
                const sortedLedger = db.taxTransactions.sort((a,b) => new Date(b.date) - new Date(a.date));
                if (sortedLedger.length === 0) {
                    ledgerTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); font-size:0.85rem;">기록된 세금 거래가 없습니다.</td></tr>`;
                } else {
                    sortedLedger.forEach(item => {
                        const tr = document.createElement('tr');
                        const tDate = new Date(item.date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        const typeText = item.type === 'deposit' ? '📈 세입 적립' : '📉 세출 지급';
                        const typeColor = item.type === 'deposit' ? '#2b8a3e' : '#e74c3c';
                        tr.innerHTML = `
                            <td>${tDate}</td>
                            <td style="font-weight:bold; color:${typeColor};">${typeText}</td>
                            <td style="font-weight:bold; color:${typeColor};">${item.type === 'deposit' ? '+' : '-'}${item.amount} ${getCurrencyName()}</td>
                            <td>${item.description}</td>
                        `;
                        ledgerTbody.appendChild(tr);
                    });
                }
            }
        }

        // --- 교사용 세금 탭 렌더링 ---
        function renderTeacherTaxTab(db) {
            updateTaxVaultCard(db);

            // 공통 세금 UI 업데이트 (교사/학생 공용 요소)
            const taxTotal = db.tax ? db.tax.totalTax : 0;
            const taxTotalEl = document.getElementById('tax-total-val');
            if (taxTotalEl) taxTotalEl.innerText = taxTotal.toLocaleString();

            // 교사 전용 세금 카드 업데이트
            const taxTotalTeacherEl = document.getElementById('tax-total-val-teacher');
            if (taxTotalTeacherEl) taxTotalTeacherEl.innerText = taxTotal.toLocaleString();

            if (db.taxGoals && db.taxGoals.length > 0) {
                const mainGoal = db.taxGoals[0];
                const targetValEl = document.getElementById('tax-target-val');
                if (targetValEl) targetValEl.innerText = mainGoal.targetAmount.toLocaleString();
                const percent = Math.min(100, Math.round((taxTotal / mainGoal.targetAmount) * 100));
                const percentEl = document.getElementById('tax-percent-text');
                if (percentEl) percentEl.textContent = `${percent}%`;
                const circleEl = document.getElementById('tax-circle-fill');
                if (circleEl) circleEl.setAttribute('stroke-dasharray', `${percent}, 100`);
                const progressEl = document.getElementById('tax-progress-fill');
                if (progressEl) progressEl.style.width = `${percent}%`;
                // 교사 전용 진행률 텍스트
                const teacherProgressEl = document.getElementById('tax-teacher-progress-text');
                if (teacherProgressEl) teacherProgressEl.innerText = `${percent}% 달성 (목표: ${mainGoal.targetAmount.toLocaleString()} ${getCurrencyName()})`;
            }

            // 교사용 세금 목표 목록 렌더링
            const goalListDiv = document.getElementById('teacher-tax-goal-list');
            if (goalListDiv) {
                goalListDiv.innerHTML = "";
                if (db.taxGoals.length === 0) {
                    goalListDiv.innerHTML = `<p style="font-size: 0.9rem; color: var(--text-muted); padding: 15px; text-align: center;">등록된 공동체 목표가 없습니다.</p>`;
                } else {
                    db.taxGoals.forEach((goal, idx) => {
                        const pct = Math.min(100, Math.round((taxTotal / goal.targetAmount) * 100));
                        const item = document.createElement('div');
                        item.style.padding = "15px";
                        item.style.borderRadius = "12px";
                        item.style.border = "1px solid var(--border-color)";
                        item.style.background = pct >= 100 ? "#e8f8f5" : "#fafafa";
                        item.style.display = "flex";
                        item.style.justifyContent = "space-between";
                        item.style.alignItems = "center";
                        item.style.marginBottom = "10px";

                        item.innerHTML = `
                            <div style="flex: 1; padding-right: 15px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">
                                    <strong style="${pct >= 100 ? 'color:#2ecc71;' : 'color: var(--text-main);'}">${idx+1}. ${goal.description}</strong>
                                    <span style="font-weight:bold; color:var(--text-main);">${pct}% 달성</span>
                                </div>
                                <div style="font-size: 0.8rem; color:var(--text-muted);">
                                    목표액: ${goal.targetAmount.toLocaleString()} ${getCurrencyName()} (현재 잔여: ${Math.max(0, goal.targetAmount - taxTotal).toLocaleString()} ${getCurrencyName()})
                                </div>
                                <div class="tax-progress-bar" style="height: 10px; margin-top:8px;">
                                    <div class="tax-progress-fill" style="width: ${pct}%; background: ${pct >= 100 ? '#2ecc71' : 'var(--primary)'}"></div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button class="btn btn-primary" style="font-size: 0.8rem; padding: 6px 12px; font-weight: bold; min-width: 60px;" onclick="editTaxGoal('${goal.id}')">수정</button>
                                <button class="btn btn-danger" style="font-size: 0.8rem; padding: 6px 12px; font-weight: bold; min-width: 60px;" onclick="removeTaxGoal('${goal.id}')">삭제</button>
                            </div>
                        `;
                        goalListDiv.appendChild(item);
                    });
                }
            }

            // 세금 입출금 장부
            const ledgerTbody = document.getElementById('teacher-tax-ledger-tbody');
            ledgerTbody.innerHTML = "";
            const sortedLedger = db.taxTransactions.sort((a,b) => new Date(b.date) - new Date(a.date));

            sortedLedger.forEach(item => {
                const tr = document.createElement('tr');
                const tDate = new Date(item.date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const typeText = item.type === 'deposit' ? '📈 세입 적립' : '📉 세출 지급';
                const typeColor = item.type === 'deposit' ? '#2b8a3e' : '#e74c3c';
                tr.innerHTML = `
                    <td>${tDate}</td>
                    <td style="font-weight:bold; color:${typeColor};">${typeText}</td>
                    <td style="font-weight:bold; color:${typeColor};">${item.type === 'deposit' ? '+' : '-'}${item.amount} 치킨</td>
                    <td>${item.description}</td>
                `;
                ledgerTbody.appendChild(tr);
            });
        }

        // 세금 임의 차감(출금)
        function handleWithdrawTax() {
            const amount = parseInt(document.getElementById('tax-withdraw-amount').value);
            const desc = document.getElementById('tax-withdraw-desc').value.trim();

            if (isNaN(amount) || amount <= 0 || !desc) {
                showToast("출금 금액과 정당한 사유를 기재해 주세요.", "danger");
                return;
            }

            const db = getDB();
            if (db.tax.totalTax < amount) {
                showToast("적립된 학급 세금 국고 잔액이 부족합니다.", "danger");
                return;
            }

            db.tax.totalTax -= amount;
            db.taxTransactions.push({
                id: "tax_wd_" + Date.now(),
                date: new Date().toISOString(),
                type: "withdraw",
                amount: amount,
                description: `교사 세금 인출 집행: ${desc}`
            });

            saveDB(db);
            showToast(`🏛️ 세금 ${amount} 치킨이 성공적으로 출금되었습니다.`, "success");
            
            document.getElementById('tax-withdraw-amount').value = "";
            document.getElementById('tax-withdraw-desc').value = "";
            loadTabData("tax");
        }

        // 세금 공동체 목표 추가
        function handleAddTaxGoal() {
            const desc = document.getElementById('tax-target-desc').value.trim();
            const amount = parseInt(document.getElementById('tax-target-price').value);

            if (!desc || isNaN(amount) || amount <= 0) {
                showToast("목표 내용과 목표 수치를 바르게 입력해 주세요.", "danger");
                return;
            }

            const db = getDB();
            db.taxGoals.push({
                id: "goal_" + Date.now(),
                description: desc,
                targetAmount: amount,
                current: 0
            });

            db.taxGoals.sort((a,b) => a.targetAmount - b.targetAmount);
            saveDB(db);

            showToast("🎯 학급 공동체 목표가 신설되었습니다.", "success");
            document.getElementById('tax-target-desc').value = "";
            document.getElementById('tax-target-price').value = "";
            loadTabData("tax");
        }

        // 공동체 목표 삭제
        function removeTaxGoal(goalId) {
            if (!confirm("🎯 이 공동체 목표를 정말로 삭제하시겠습니까?")) return;
            const db = getDB();
            db.taxGoals = db.taxGoals.filter(goal => goal.id !== goalId);
            saveDB(db);
            showToast("🎯 공동체 목표가 정상적으로 삭제되었습니다.", "success");
            loadTabData("tax");
        }

        // 공동체 목표 수정
        function editTaxGoal(goalId) {
            const db = getDB();
            const idx = db.taxGoals.findIndex(g => g.id === goalId);
            if (idx === -1) return;
            
            const goal = db.taxGoals[idx];
            
            const newDesc = prompt("새로운 목표 내용을 입력하세요:", goal.description);
            if (newDesc === null) return;
            const trimmedDesc = newDesc.trim();
            if (!trimmedDesc) {
                showToast("목표 내용은 비어둘 수 없습니다.", "danger");
                return;
            }
            
            const newAmountStr = prompt("새로운 목표 설정액(치킨)을 입력하세요:", goal.targetAmount);
            if (newAmountStr === null) return;
            const newAmount = parseInt(newAmountStr);
            if (isNaN(newAmount) || newAmount <= 0) {
                showToast("올바른 목표 금액을 입력해 주세요.", "danger");
                return;
            }
            
            db.taxGoals[idx].description = trimmedDesc;
            db.taxGoals[idx].targetAmount = newAmount;
            
            db.taxGoals.sort((a,b) => a.targetAmount - b.targetAmount);
            saveDB(db);
            showToast("🎯 공동체 목표가 성공적으로 수정되었습니다.", "success");
            loadTabData("tax");
        }

        // ==========================================
        // 8. TAB 6: MY PAGE & PAYSLIP (월급 명세서)
        // ==========================================
        let tempAvatar = null;

        function renderMyPage() {
            const db = getDB();
            const student = db.students.find(s => s.id === currentUser.id);
            
            // 아바타 에디터 초기화
            if (student) {
                if (!tempAvatar) {
                    tempAvatar = student.avatar ? { ...student.avatar } : { face: "smile", hair: "short", accessory: "none" };
                }
                renderAvatarEditorPreview(student);
            }

            // 가방 렌더링
            renderMyInventory(db);
        }

        // 학생 보유 아이템 가방 렌더링
        function renderMyInventory(db) {
            const invContainer = document.getElementById('my-inventory-container');
            if (!invContainer) return;
            invContainer.innerHTML = "";

            const myInv = db.inventory.filter(inv => inv.studentId === currentUser.id && inv.quantity > 0);
            if (myInv.length === 0) {
                invContainer.innerHTML = `<p style="font-size: 0.9rem; color: var(--text-muted); width: 100%; text-align:center;">보유하고 있는 권리나 간식이 없습니다.</p>`;
            } else {
                myInv.forEach(inv => {
                    const prod = db.shop.find(p => p.id === inv.productId);
                    if (prod) {
                        const card = document.createElement('div');
                        card.className = "inventory-card";
                        card.style.cursor = "pointer";

                        let pDateText = "구매 정보 없음";
                        if (inv.purchaseDate) {
                            const d = new Date(inv.purchaseDate);
                            const pad = (n) => n.toString().padStart(2, '0');
                            pDateText = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        }
                        card.title = `구매 일시: ${pDateText}`;
                        card.onclick = (e) => {
                            if (e.target.tagName !== 'BUTTON') {
                                alert(`🏷️ ${prod.name}\n구매 일시: ${pDateText}`);
                            }
                        };

                        const icon = prod.emoji || (prod.category === 'coupon' ? '🎫' : '🍪');
                        
                        // 이 고유 인벤토리 아이템이 현재 승인 대기중인지 검사
                        const isPending = (db.useRequests || []).some(r => r.inventoryId === inv.id && r.status === 'pending');

                        let buttonHTML = "";
                        let pendingHTML = "";
                        
                        if (isPending) {
                            buttonHTML = `<button class="btn btn-secondary" style="font-size: 0.75rem; padding: 4px 8px; margin-top: 5px;" disabled>승인 대기 중</button>`;
                            pendingHTML = `<div style="font-size:0.75rem; color:#d97706; margin-top:5px; font-weight:bold; display:flex; align-items:center; gap:4px;">
                                ⏳ 승인 대기 
                                <button class="btn btn-danger" style="font-size:0.65rem; padding:1px 4px;" onclick="handleCancelUseRequest('${inv.id}')">요청 취소</button>
                            </div>`;
                        } else {
                            buttonHTML = `<button class="btn btn-primary" style="font-size: 0.75rem; padding: 4px 8px; margin-top: 5px;" onclick="handleRequestUseItem('${inv.id}')">사용 요청하기</button>`;
                        }

                        card.innerHTML = `
                            <div style="display:flex; flex-direction:column; width:100%;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>${icon} <strong>${prod.name}</strong></span>
                                    <span class="badge" style="background:#e3faf2; color:#0b7285;">보유</span>
                                </div>
                                ${buttonHTML}
                                ${pendingHTML}
                            </div>
                        `;
                        invContainer.appendChild(card);
                    }
                });
            }

            // --- 구매 신청 대기 중인 아이템 렌더링 ---
            const pendingContainer = document.getElementById('pending-purchases');
            if (pendingContainer) {
                pendingContainer.innerHTML = "";
                const myPending = (db.pendingPayments || []).filter(p => p.studentId === currentUser.id && p.status === "pending");
                if (myPending.length === 0) {
                    pendingContainer.innerHTML = `<p style="font-size: 0.9rem; color: #868e96; width: 100%; text-align:center;">구매 신청 대기 중인 아이템이 없습니다.</p>`;
                } else {
                    myPending.forEach(p => {
                        const itemObj = db.shop.find(item => item.id === p.productId);
                        const emoji = itemObj ? (itemObj.emoji || (itemObj.category === 'coupon' ? '🎫' : '🍪')) : '⏳';
                        
                        const card = document.createElement('div');
                        card.className = "inventory-card";
                        card.style.cursor = "pointer";
                        card.style.background = "#fff";
                        card.style.border = "1px dashed #ffa94d";
                        
                        let reqDateText = "신청 정보 없음";
                        if (p.date) {
                            const d = new Date(p.date);
                            const pad = (n) => n.toString().padStart(2, '0');
                            reqDateText = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                        }
                        
                        card.title = `신청 일시: ${reqDateText}`;
                        card.onclick = () => {
                            alert(`⏳ ${p.productName} (구매 승인 대기 중)\n신청 일시: ${reqDateText}\n승인 대기 금액: ${p.amount} 치킨 (부가세 포함)`);
                        };
                        
                        card.innerHTML = `
                            <div style="display:flex; flex-direction:column; width:100%;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">
                                    <span>${emoji} <strong>${p.productName}</strong></span>
                                    <span class="badge" style="background:#fff3bf; color:#d9480f; border:1px solid #ffe066;">대기</span>
                                </div>
                                <div style="font-size: 0.8rem; color: #d9480f; font-weight: bold;">
                                    결제 금액: ${p.amount.toLocaleString()} 치킨
                                </div>
                                <div style="font-size: 0.75rem; color: #868e96; margin-top: 3px;">
                                    신청일: ${reqDateText}
                                </div>
                            </div>
                        `;
                        pendingContainer.appendChild(card);
                    });
                }
            }
        }

        // 아이템 사용 요청
        async function handleRequestUseItem(inventoryId) {
            const db = getDB();
            const inv = db.inventory.find(i => i.id === inventoryId && i.studentId === currentUser.id);
            if (!inv) {
                showToast("보유하지 않은 아이템입니다.", "danger");
                return;
            }

            const prod = db.shop.find(p => p.id === inv.productId);
            const student = db.students.find(s => s.id === currentUser.id);
            if (!prod || !student) return;

            const isAlreadyRequested = db.useRequests.some(r => r.inventoryId === inventoryId && r.status === 'pending');
            if (isAlreadyRequested) {
                showToast("이미 이 아이템에 대한 사용 승인 요청을 보냈습니다.", "danger");
                return;
            }

            showSpinner("사용 요청을 전송하는 중입니다...");

            try {
                const reqId = "req_use_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                await fs.collection("shop_orders").doc(reqId).set({
                    id: reqId,
                    type: "use_request",
                    studentId: currentUser.id,
                    studentName: student.name,
                    productId: inv.productId,
                    inventoryId: inv.id,
                    productName: prod.name,
                    emoji: prod.emoji || (prod.category === 'coupon' ? '🎫' : '🍪'),
                    category: prod.category,
                    status: "pending",
                    date: new Date().toISOString()
                });
                showToast(`⏳ ${prod.name} 사용 요청이 등록되었습니다. 교사의 승인 후 사용 처리됩니다.`, "warning");
            } catch (error) {
                console.error("Error requesting use item: ", error);
                showToast("🚫 사용 요청 중 오류가 발생했습니다. 다시 시도해 주세요.", "danger");
            } finally {
                hideSpinner();
            }
        }

        // 아이템 사용 요청 취소
        async function handleCancelUseRequest(inventoryId) {
            const db = getDB();
            const req = db.useRequests.find(r => r.studentId === currentUser.id && r.inventoryId === inventoryId && r.status === 'pending');
            if (req) {
                showSpinner("사용 요청을 취소하는 중입니다...");
                try {
                    await fs.collection("shop_orders").doc(req.id).delete();
                    showToast("사용 요청이 취소되었습니다.", "success");
                } catch (error) {
                    console.error("Error cancelling use request: ", error);
                    showToast("🚫 취소 중 오류가 발생했습니다. 다시 시도해 주세요.", "danger");
                } finally {
                    hideSpinner();
                }
            }
        }

        // --- 아바타 미리보기 및 UI 갱신 ---
        function renderAvatarEditorPreview(student) {
            const previewEl = document.getElementById('mypage-avatar-preview');
            const nameEl = document.getElementById('avatar-student-name');
            const jobEl = document.getElementById('avatar-student-job');

            if (previewEl && student) {
                previewEl.innerText = tempAvatar.emoji || "👶";
                previewEl.style.backgroundColor = tempAvatar.bgColor || "#ffe3e3";
                nameEl.innerText = student.name;
                jobEl.innerText = student.job || "무직";
            }

            // 이모지 선택 active 표시
            document.querySelectorAll('.avatar-option').forEach(el => {
                const emoji = el.getAttribute('data-emoji');
                if (tempAvatar && tempAvatar.emoji === emoji) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            });

            // 배경색 선택 active 표시
            document.querySelectorAll('.color-option').forEach(el => {
                const color = el.getAttribute('data-color');
                if (tempAvatar && tempAvatar.bgColor === color) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            });
        }

        // --- 이모지 임시 선택 ---
        function selectAvatarEmoji(emoji) {
            if (!tempAvatar) tempAvatar = { emoji: "👶", bgColor: "#ffe3e3" };
            tempAvatar.emoji = emoji;
            
            const db = getDB();
            const student = db.students.find(s => s.id === currentUser.id);
            renderAvatarEditorPreview(student);
        }

        // --- 배경색 임시 선택 ---
        function selectAvatarColor(color) {
            if (!tempAvatar) tempAvatar = { emoji: "👶", bgColor: "#ffe3e3" };
            tempAvatar.bgColor = color;
            
            const db = getDB();
            const student = db.students.find(s => s.id === currentUser.id);
            renderAvatarEditorPreview(student);
        }

        // --- 선택 아바타 DB 영구 저장 ---
        function saveAvatarSelection() {
            const db = getDB();
            const student = db.students.find(s => s.id === currentUser.id);
            if (student) {
                student.avatar = { ...tempAvatar };
                saveDB(db);
                
                // 헤더 우측 아바타 갱신
                const headerAvatar = document.getElementById('header-user-avatar');
                if (headerAvatar) {
                    headerAvatar.innerHTML = generateAvatarHTML(student.avatar);
                }
                
                showToast("💾 나만의 아바타 디자인이 저장되었습니다!", "success");
            }
        }

        // ==========================================
        // 9. TAB 7: CSV FILE UPLOAD LOGIC
        // ==========================================
        function downloadCSVTemplate() {
            const headers = "아이디,이름,초기비밀번호,직업,역할,기본급\n";
            const sampleData = "student1,김민우,1234,반장,학급대표,300\nstudent4,이영희,1234,청소 당번,교실 청소,200\n";
            const csvContent = "\uFEFF" + headers + sampleData; // UTF-8 with BOM
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "학급은행_학생등록양식.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function handleCSVUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const encodingSelect = document.getElementById('csv-encoding-select');
            const encoding = encodingSelect ? encodingSelect.value : "EUC-KR";

            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                parseCSV(text);
            };
            reader.readAsText(file, encoding);
        }

        function parseCSV(text) {
            const lines = text.split(/\r?\n/);
            const previewTbody = document.getElementById('csv-preview-tbody');
            previewTbody.innerHTML = "";
            tempCSVData = [];

            if (lines.length <= 1) {
                showToast("파싱할 CSV 데이터가 부족합니다.", "danger");
                return;
            }

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const cols = line.split(',');
                if (cols.length < 2) continue;

                const id = cols[0].trim();
                const name = cols[1].trim();
                const password = cols[2] ? cols[2].trim() : "1234";
                const job = cols[3] ? cols[3].trim() : "무직";
                const role = cols[4] ? cols[4].trim() : "";
                const baseSalary = cols[5] ? parseInt(cols[5].trim()) : 50;

                tempCSVData.push({ id, name, password, job, role, baseSalary: isNaN(baseSalary) ? 50 : baseSalary });

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><code>${id}</code></td>
                    <td><strong>${name}</strong></td>
                    <td><code>${password}</code></td>
                    <td>${job}</td>
                    <td>${role}</td>
                    <td style="font-weight:bold; color:#d9480f;">${baseSalary} 치킨</td>
                `;
                previewTbody.appendChild(tr);
            }

            if (tempCSVData.length > 0) {
                document.getElementById('csv-preview-container').style.display = "block";
                document.getElementById('csv-upload-instruction').innerText = `📄 ${tempCSVData.length}명의 데이터 파싱 완료!`;
            } else {
                showToast("올바른 CSV 규격이 아닙니다.", "danger");
            }
        }

        function handleImportCSVData() {
            if (tempCSVData.length === 0) return;

            const db = getDB();
            let addedCount = 0;
            let updatedCount = 0;

            tempCSVData.forEach(item => {
                const existIdx = db.students.findIndex(s => s.id === item.id);
                if (existIdx === -1) {
                    db.students.push({
                        id: item.id,
                        name: item.name,
                        password: item.password,
                        balance: 500, 
                        isFrozen: false,
                        job: item.job,
                        role: item.role,
                        baseSalary: item.baseSalary,
                        mileage: 0,
                        avatar: { face: "smile", hair: "short", accessory: "none" }
                    });
                    
                    db.transactions.push({
                        id: "tx_init_" + item.id + "_" + Date.now(),
                        studentId: item.id,
                        date: new Date().toISOString(),
                        description: "🍗 학급 경제 시작 초기 보조금",
                        type: "deposit",
                        amount: 500,
                        balanceAfter: 500,
                        isSavingsMaturity: false
                    });
                    
                    addedCount++;
                } else {
                    const student = db.students[existIdx];
                    student.name = item.name;
                    student.password = item.password;
                    student.job = item.job;
                    student.role = item.role;
                    student.baseSalary = item.baseSalary;
                    
                    db.students[existIdx] = student;
                    updatedCount++;
                }
            });

            saveDB(db);
            showToast(`✔️ 학생 데이터 반영 완료! (신규 등록: ${addedCount}명, 정보 갱신: ${updatedCount}명)`, "success");
            
            document.getElementById('csv-preview-container').style.display = "none";
            document.getElementById('csv-file-input').value = "";
            document.getElementById('csv-upload-instruction').innerText = "📁 이곳을 클릭하여 학생 명단 (.csv) 파일을 올리세요.";
            tempCSVData = [];
            
            loadTabData("manage");
        }

        // ==========================================
        // 10. SECURITY & TOAST SYSTEM
        // ==========================================


        function openGASConfigModal() {
            document.getElementById('gas-modal').style.display = "flex";
        }

        function closeGASConfigModal() {
            document.getElementById('gas-modal').style.display = "none";
        }

        function showToast(message, type = "info") {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast-msg ${type}`;
            
            let emoji = "ℹ️";
            if (type === "success") emoji = "🎉";
            if (type === "danger") emoji = "🚫";
            if (type === "warning") emoji = "🚨";

            toast.innerHTML = `
                <span>${emoji}</span>
                <span>${message}</span>
                <span class="toast-close" onclick="this.parentElement.remove()">&times;</span>
            `;

            container.appendChild(toast);

            setTimeout(() => {
                toast.remove();
            }, 5000);
        }

        function handleChangePasswordSubmit() {
            const currentPw = document.getElementById('change-pw-current').value;
            const newPw = document.getElementById('change-pw-new').value;
            const confirmPw = document.getElementById('change-pw-confirm').value;

            if (!currentPw || !newPw || !confirmPw) {
                showToast("모든 비밀번호 필드를 입력해주세요.", "danger");
                return;
            }

            const db = getDB();
            const studentIndex = db.students.findIndex(s => s.id === currentUser.id);
            if (studentIndex === -1) return;

            const student = db.students[studentIndex];
            if (student.password !== currentPw) {
                showToast("현재 비밀번호가 일치하지 않습니다.", "danger");
                return;
            }

            if (newPw !== confirmPw) {
                showToast("새 비밀번호와 확인이 일치하지 않습니다.", "danger");
                return;
            }

            if (currentPw === newPw) {
                showToast("새 비밀번호는 현재 비밀번호와 달라야 합니다.", "warning");
                return;
            }

            db.students[studentIndex].password = newPw;
            saveDB(db);
            currentUser.password = newPw;

            document.getElementById('change-pw-current').value = '';
            document.getElementById('change-pw-new').value = '';
            document.getElementById('change-pw-confirm').value = '';

            showToast("비밀번호가 성공적으로 변경되었습니다.", "success");
        }

        function openStudentDeleteModal() {
            document.getElementById('delete-account-verify-pw').value = '';
            document.getElementById('student-delete-account-modal').style.display = 'flex';
        }

        function closeStudentDeleteModal() {
            document.getElementById('student-delete-account-modal').style.display = 'none';
        }

        function handleStudentDeleteAccountSubmit() {
            const verifyPw = document.getElementById('delete-account-verify-pw').value.trim();
            if (!verifyPw) {
                showToast("비밀번호를 입력해 주세요.", "danger");
                return;
            }

            const db = getDB();
            const studentIndex = db.students.findIndex(s => s.id === currentUser.id);
            if (studentIndex === -1) {
                showToast("오류: 세션에 일치하는 학생 정보가 없습니다.", "danger");
                return;
            }

            const student = db.students[studentIndex];
            if (student.password !== verifyPw) {
                showToast("비밀번호가 올바르지 않습니다. 다시 입력해 주세요.", "danger");
                return;
            }

            // 최종 삭제
            db.students.splice(studentIndex, 1);
            saveDB(db);

            closeStudentDeleteModal();
            alert("계정이 영구적으로 삭제되었습니다. 이용해 주셔서 감사합니다.");
            
            // 즉시 로그아웃 처리
            logout();
        }

        window.openStudentDeleteModal = openStudentDeleteModal;
        window.closeStudentDeleteModal = closeStudentDeleteModal;
        window.handleStudentDeleteAccountSubmit = handleStudentDeleteAccountSubmit;
        window.handleCurrencyUpload = handleCurrencyUpload;
        window.handleCurrencyReset = handleCurrencyReset;
        window.updateCurrencyUnits = updateCurrencyUnits;
        window.handleSaveCurrencyName = handleSaveCurrencyName;
        window.getCurrencyName = getCurrencyName;
        window.renderStudentBalanceDisplay = renderStudentBalanceDisplay;
        window.handleResetStudentPassword = handleResetStudentPassword;
        window.openTeacherStudentEditModal = openTeacherStudentEditModal;
        window.closeTeacherStudentEditModal = closeTeacherStudentEditModal;
        window.handleTeacherStudentEditSubmit = handleTeacherStudentEditSubmit;
        window.handleTeacherStudentDelete = handleTeacherStudentDelete;
        window.handleManualMileageAward = handleManualMileageAward;
        window.deleteStudent = deleteStudent;
        window.editStudent = editStudent;
        window.openEditModal = openEditModal;
        window.updateMileageStudentSelect = updateMileageStudentSelect;

        function handleResetStudentPassword(studentId) {
            if (confirm("해당 학생의 비밀번호를 '1234'로 초기화하시겠습니까?")) {
                const db = getDB();
                const student = db.students.find(s => s.id === studentId);
                if (student) {
                    // 비번초기화도 Firestore 연동을 통해 확실하게 업데이트합니다.
                    showSpinner("비밀번호를 초기화하는 중...");
                    fs.collection("users").doc(studentId).update({
                        password: "1234"
                    }).then(() => {
                        showToast(`${student.name} 학생의 비밀번호가 '1234'로 초기화되었습니다.`, "success");
                    }).catch(err => {
                        console.error("비밀번호 초기화 실패:", err);
                        alert("계정 처리에 실패했습니다. 보안 규칙을 확인하세요.");
                    }).finally(() => {
                        hideSpinner();
                    });
                }
            }
        }

        // 가상 원격 테스트용 및 교사용 학생 수정/삭제 통합 모달 열기
        function openEditModal(studentId) {
            try {
                console.log("수정 모달 작동 시작, 대상 ID:", studentId);
                window.editingStudentId = studentId;

                const db = getDB();
                const student = db.students.find(s => s.id === studentId);
                if (!student) {
                    throw new Error("학생 정보를 찾을 수 없습니다. (ID: " + studentId + ")");
                }

                // 모달 각 필드에 현재 학생 정보 매핑
                document.getElementById('edit-student-name').value = student.name || '';
                document.getElementById('edit-student-password').value = student.password || '';
                document.getElementById('edit-student-balance').value = student.balance !== undefined ? student.balance : 0;
                document.getElementById('edit-student-mileage').value = student.mileageBalance !== undefined ? student.mileageBalance : (student.mileage || 0);
                document.getElementById('edit-student-salary').value = student.baseSalary !== undefined ? student.baseSalary : 50;

                // 직업 드롭다운 채우기 및 현재 값 선택
                const jobSelect = document.getElementById('edit-student-job');
                if (jobSelect) {
                    jobSelect.innerHTML = '<option value="무직">무직 (미배정)</option>';
                    db.jobs.forEach(job => {
                        if (job.name !== '무직') {
                            const opt = document.createElement('option');
                            opt.value = job.name;
                            opt.innerText = `${job.name} (기본급: ${job.baseSalary}${getCurrencyName()})`;
                            jobSelect.appendChild(opt);
                        }
                    });
                    jobSelect.value = student.job || '무직';
                }

                // 모달 표시
                const modal = document.getElementById('edit-student-modal');
                if (modal) {
                    modal.style.display = 'flex';
                } else {
                    throw new Error("edit-student-modal 요소가 HTML에 없습니다.");
                }
            } catch (error) {
                alert("🚨 수정 모달 에러: " + error.message);
                console.error(error);
            }
        }

        // 구버전 호환용 별칭
        function openTeacherStudentEditModal(studentId) { openEditModal(studentId); }
        function editStudent(studentId) { openEditModal(studentId); }

        function closeTeacherStudentEditModal() {
            window.editingStudentId = null;
            const modal = document.getElementById('edit-student-modal');
            if (modal) modal.style.display = 'none';
        }

        // ✅ 변경사항 저장 - Firestore 업데이트 후 로컬 db 즉시 동기화하여 새로고침 없이 반영
        async function handleTeacherStudentEditSubmit() {
            try {
                const studentId = window.editingStudentId;
                if (!studentId) { alert("수정할 학생이 지정되지 않았습니다."); return; }

                const name = document.getElementById('edit-student-name').value.trim();
                const newPassword = document.getElementById('edit-student-password').value.trim();
                const job = document.getElementById('edit-student-job').value;
                const balance = Number(document.getElementById('edit-student-balance').value);
                const mileage = Number(document.getElementById('edit-student-mileage').value);
                const baseSalary = Number(document.getElementById('edit-student-salary').value);

                if (!name) { alert("이름을 입력해 주세요."); return; }
                if (isNaN(balance)) { alert("올바른 잔액(숫자)을 입력해 주세요."); return; }
                if (isNaN(mileage)) { alert("올바른 마일리지(숫자)를 입력해 주세요."); return; }
                if (isNaN(baseSalary)) { alert("올바른 월급(숫자)을 입력해 주세요."); return; }

                showSpinner("학생 정보를 수정하는 중...");

                // Firestore 업데이트 데이터 구성 (비밀번호: 빈칸이면 기존 유지)
                const updateData = {
                    name: name,
                    job: job,
                    balance: balance,
                    mileage: mileage,
                    mileageBalance: mileage,
                    baseSalary: baseSalary
                };
                if (newPassword) updateData.password = newPassword;

                await fs.collection("users").doc(studentId).update(updateData);

                // ✅ 핵심 수정: Firestore 성공 후 로컬 db.students 배열 즉시 동기화
                // (onSnapshot이 도달하기 전에 화면을 즉각 갱신하기 위함)
                const db = getDB();
                const idx = db.students.findIndex(s => s.id === studentId);
                if (idx !== -1) {
                    db.students[idx] = {
                        ...db.students[idx],
                        name, job, balance,
                        mileage, mileageBalance: mileage,
                        baseSalary,
                        ...(newPassword ? { password: newPassword } : {})
                    };
                    saveDB(db);
                }

                // 모달 닫기
                document.getElementById('edit-student-modal').style.display = 'none';
                window.editingStudentId = null;

                showToast(`✅ ${name} 학생 정보가 수정되었습니다.`, "success");

                // 즉시 리렌더링
                renderTeacherManageTab(getDB());

            } catch (err) {
                console.error("❌ 수정 실패:", err);
                alert("수정 실패: " + err.message);
            } finally {
                hideSpinner();
            }
        }

        // 🗑 모달 내 계정 삭제 버튼 - 삭제 후 로컬 db 즉시 동기화하여 새로고침 없이 반영
        async function handleDeleteFromModal() {
            const studentId = window.editingStudentId;
            if (!studentId) { alert("삭제할 학생이 지정되지 않았습니다."); return; }

            const db = getDB();
            const student = db.students.find(s => s.id === studentId);
            const name = student ? student.name : studentId;

            if (!confirm(`⚠️ ${name} 학생의 계정을 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

            showSpinner("학생 계정을 삭제하는 중...");
            try {
                await fs.collection("users").doc(studentId).delete();

                // ✅ 핵심 수정: Firestore 삭제 성공 후 로컬 db.students 배열에서 즉시 제거
                // (onSnapshot이 도달하기 전에 화면을 즉각 갱신하기 위함)
                const freshDB = getDB();
                const delIdx = freshDB.students.findIndex(s => s.id === studentId);
                if (delIdx !== -1) {
                    freshDB.students.splice(delIdx, 1);
                    saveDB(freshDB);
                }

                // 모달 닫기
                document.getElementById('edit-student-modal').style.display = 'none';
                window.editingStudentId = null;

                showToast(`✅ ${name} 학생 계정이 삭제되었습니다.`, "success");

                // 즉시 리렌더링
                renderTeacherManageTab(getDB());

            } catch (err) {
                console.error("❌ 삭제 실패:", err);
                alert("삭제 실패: " + err.message);
            } finally {
                hideSpinner();
            }
        }

        // 기존 삭제 핸들러 호환용
        async function deleteStudent(studentId) {
            const db = getDB();
            const student = db.students.find(s => s.id === studentId);
            const name = student ? student.name : studentId;
            if (!confirm(`⚠️ 이 학생(${name})의 계정을 삭제하시겠습니까?`)) return;
            showSpinner("학생 계정을 삭제하는 중...");
            try {
                await fs.collection("users").doc(studentId).delete();
                showToast(`✅ ${name} 학생의 계정이 삭제되었습니다!`, "success");
            } catch (err) {
                console.error("학생 계정 삭제 에러: ", err);
                alert("계정 처리에 실패했습니다.");
            } finally {
                hideSpinner();
            }
        }

        function handleTeacherStudentDelete(studentId) { deleteStudent(studentId); }

        // ✅ 잔액 & 마일리지 직접 관리 [적용] 버튼 핸들러
        // - Firestore users 컬렉션 즉시 업데이트 (Number 타입 강제 변환)
        // - 학생 통장 내역(transactions)에 교사 조정 레코드 추가
        // - 로컬 db.students 즉시 동기화 → 새로고침 없이 화면 반영
        async function applyBalanceChange(studentId) {
            const db = getDB();
            const student = db.students.find(s => s.id === studentId);
            if (!student) { alert("학생 정보를 찾을 수 없습니다."); return; }

            const balInput   = document.getElementById(`inp-bal-${studentId}`);
            const milInput   = document.getElementById(`inp-mil-${studentId}`);
            const reasonInput = document.getElementById(`inp-reason-${studentId}`);

            const newBalRaw = balInput ? balInput.value.trim() : "";
            const newMilRaw = milInput ? milInput.value.trim() : "";
            const reason    = reasonInput ? reasonInput.value.trim() : "";

            // 둘 다 비어있으면 안내
            if (newBalRaw === "" && newMilRaw === "") {
                alert("변경할 잔액 또는 마일리지를 입력해 주세요.");
                return;
            }
            if (!reason) {
                alert("변경 사유/내용을 입력해 주세요.");
                return;
            }

            const prevBalance = student.balance || 0;
            const prevMileage = student.mileageBalance !== undefined ? student.mileageBalance : (student.mileage || 0);
            const newBalance  = newBalRaw !== "" ? Number(newBalRaw) : prevBalance;
            const newMileage  = newMilRaw !== "" ? Number(newMilRaw) : prevMileage;

            if (isNaN(newBalance) || isNaN(newMileage)) {
                alert("잔액/마일리지는 숫자만 입력 가능합니다.");
                return;
            }

            showSpinner("잔액을 업데이트하는 중...");
            try {
                const now = new Date().toISOString();
                const balDiff = newBalance - prevBalance;
                const txType  = balDiff >= 0 ? "deposit" : "withdrawal";

                // ① Firestore users 컬렉션 업데이트
                await fs.collection("users").doc(studentId).update({
                    balance:       Number(newBalance),
                    mileage:       Number(newMileage),
                    mileageBalance: Number(newMileage)
                });

                // ② 통장 내역(transactions)에 새 레코드 추가
                const txId = `tx_teacher_adj_${Date.now()}_${studentId}`;
                await fs.collection("transactions").doc(txId).set({
                    id:           txId,
                    studentId:    studentId,
                    date:         now,
                    type:         txType,
                    amount:       Math.abs(balDiff),
                    balanceAfter: Number(newBalance),
                    description:  `✏️ 교사 조정: ${reason}`,
                    isSavingsMaturity: false,
                    isTeacherAdj: true
                });

                // ③ 로컬 db 즉시 동기화 (onSnapshot 도달 전 화면 갱신)
                const idx = db.students.findIndex(s => s.id === studentId);
                if (idx !== -1) {
                    db.students[idx] = {
                        ...db.students[idx],
                        balance: Number(newBalance),
                        mileage: Number(newMileage),
                        mileageBalance: Number(newMileage)
                    };
                    saveDB(db);
                }

                // 입력창 초기화
                if (balInput)    balInput.value    = "";
                if (milInput)    milInput.value    = "";
                if (reasonInput) reasonInput.value = "";

                showToast(`✅ ${student.name} 학생 잔액이 조정되었습니다. (${prevBalance.toLocaleString()} → ${newBalance.toLocaleString()} ${getCurrencyName()})`, "success");

                // ④ 즉시 리렌더링
                renderTeacherManageTab(getDB());

            } catch (err) {
                console.error("❌ 잔액 조정 실패:", err);
                alert("잔액 조정 실패: " + err.message);
            } finally {
                hideSpinner();
            }
        }

        // 마일리지 직접 지급 드롭다운 동적 업데이트 함수
        function updateMileageStudentSelect(students) {
            const select = document.getElementById('mileage-student-select');
            if (!select) return;
            // 중복 방지 초기화
            select.innerHTML = '<option value="">지급할 학생 선택</option>';
            students.forEach(st => {
                const opt = document.createElement('option');
                opt.value = st.id;
                opt.innerText = `${st.name} (${st.id})`;
                select.appendChild(opt);
            });
        }

        // 교사용 개별 환경 마일리지 직접 지급
        async function handleManualMileageAward() {
            const studentId = document.getElementById('mileage-student-select').value;
            const description = document.getElementById('manual-mileage-description').value.trim();
            const amountVal = document.getElementById('manual-mileage-amount').value.trim();

            if (!studentId) {
                alert("지급할 학생을 선택해 주세요.");
                return;
            }
            if (!description) {
                alert("실천 항목(지급 사유)을 입력해 주세요.");
                return;
            }
            if (!amountVal) {
                alert("지급할 마일리지 점수를 입력해 주세요.");
                return;
            }

            const amount = parseInt(amountVal, 10);
            if (isNaN(amount) || amount <= 0) {
                alert("올바른 점수(1 이상의 정수)를 입력해 주세요.");
                return;
            }

            const db = getDB();
            const student = db.students.find(s => s.id === studentId);
            if (!student) {
                alert("해당 학생을 찾을 수 없습니다.");
                return;
            }

            showSpinner("환경 마일리지를 개별 지급하는 중...");

            try {
                const batch = fs.batch();
                const studentRef = fs.collection("users").doc(studentId);

                // 1. 학생 마일리지 누적 (increment)
                batch.update(studentRef, {
                    mileage: firebase.firestore.FieldValue.increment(amount),
                    mileageBalance: firebase.firestore.FieldValue.increment(amount)
                });

                // 2. env_mileage_ledger에 내역 기록
                const emlId = "eml_manual_" + Date.now();
                const emlRef = fs.collection("env_mileage_ledger").doc(emlId);
                batch.set(emlRef, {
                    id: emlId,
                    studentId: studentId,
                    studentName: student.name,
                    date: new Date().toISOString(),
                    type: "manual",
                    description: `🌿 교사 직접 지급: ${description}`,
                    amount: amount
                });

                await batch.commit();

                showToast(`✅ ${student.name} 학생에게 환경 마일리지 ${amount}점이 지급되었습니다!`, "success");
                alert(`지급 완료! (${student.name} 학생에게 ${amount}점 지급)`);

                // 인풋 폼 리셋
                document.getElementById('mileage-student-select').value = "";
                document.getElementById('manual-mileage-description').value = "";
                document.getElementById('manual-mileage-amount').value = "";

            } catch (error) {
                console.error("수동 마일리지 지급 중 오류 발생: ", error);
                alert("마일리지 지급에 실패했습니다: " + error.message);
            } finally {
                hideSpinner();
            }
        }

        // 다른 브라우저 탭/창과의 실시간 데이터 변경 감지 및 연동
        window.addEventListener('storage', function(e) {
            if (e.key === 'class_bank_db') {
                updateLogo();
                updateCurrencyUnits();
                const activeNav = document.querySelector('.nav-item.active');
                if (activeNav && currentUser) {
                    const tabId = activeNav.id.replace('nav-', '');
                    loadTabData(tabId);
                }
            }
        });
