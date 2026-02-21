// --- 初始化 Lucide Icons ---
lucide.createIcons();

// --- 系統配置 ---
const CLOUD_API_URL = "https://script.google.com/macros/s/AKfycbzsG9p587hAofHfgCoCy6-WNZmd4o4E-R00eY6LXtMnSaHB3Kv4U9MpQ5Cg_MHY1--s5g/exec"; 
const year = 2026;
const weekNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; 
const weekNamesZh = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"]; 
const storageKey = 'nordic_shift_v2026_db';

// --- 休假表圖片設定 (0代表1月，11代表12月) ---
const leaveImages = {
    0: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=1200&auto=format&fit=crop", // 1月
    1: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1000&auto=format&fit=crop", // 2月
    2: "./images/3月份休假表.jpg", // 這是 3月的圖片", // 3月 
    3: "", // 4月
    4: "", // 5月
    5: "", // 6月
    6: "", // 7月
    7: "", // 8月
    8: "", // 9月
    9: "", // 10月
    10: "", // 11月
    11: ""  // 12月
};

// --- 全域變數 ---
let currentMonth = new Date().getMonth(); 
let currentView = 'day'; 
let fullYearData = JSON.parse(localStorage.getItem(storageKey)) || {};
let autoSaveTimer = null;

// --- DOM 元素綁定 ---
const scheduleBody = document.getElementById('scheduleBody');
const monthSelect = document.getElementById('monthSelect');
const emptyState = document.getElementById('emptyState');
const autoSaveIndicator = document.getElementById('autoSaveIndicator');

// --- 系統初始化 ---
function init() {
    const now = new Date();
    if (now.getFullYear() === year) {
        currentMonth = now.getMonth();
    }
    monthSelect.value = currentMonth;
    switchView('day');
    fetchFromCloud();

    // 綁定統計輸入框的 Enter 鍵事件
    document.getElementById('stats-name-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') calculatePersonalStats();
    });
}

// --- 視圖與表格渲染邏輯 ---
function switchView(viewMode) {
    currentView = viewMode;
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${viewMode}`).classList.add('active');
    renderTable();
}

function handleMonthChange(val) {
    currentMonth = parseInt(val);
    if (currentView === 'day' || currentView === 'week') {
        switchView('month');
    } else {
        renderTable();
    }
}

function renderTable() {
    scheduleBody.innerHTML = '';
    const daysCount = new Date(year, currentMonth + 1, 0).getDate();
    if (!fullYearData[currentMonth]) fullYearData[currentMonth] = {};

    const today = new Date();
    const isCurrentMonthReal = (today.getFullYear() === year && today.getMonth() === currentMonth);
    const todayDate = today.getDate();

    let targetDays = [];
    if (currentView === 'day') {
        const targetDate = isCurrentMonthReal ? todayDate : 1; 
        targetDays.push(targetDate);
    } else if (currentView === 'week') {
        const baseDateNum = isCurrentMonthReal ? todayDate : 1;
        const baseDate = new Date(year, currentMonth, baseDateNum);
        const dayOfWeek = baseDate.getDay(); 
        const weekStart = baseDateNum - dayOfWeek;
        const weekEnd = baseDateNum + (6 - dayOfWeek);
        for (let d = weekStart; d <= weekEnd; d++) {
            if (d >= 1 && d <= daysCount) targetDays.push(d);
        }
    } else {
        for (let d = 1; d <= daysCount; d++) targetDays.push(d);
    }

    targetDays.forEach(i => {
        const dateObj = new Date(year, currentMonth, i);
        const dayIdx = dateObj.getDay();
        const isWeekend = (dayIdx === 0 || dayIdx === 6);
        const isTodayRow = (isCurrentMonthReal && i === todayDate);
        const dayData = fullYearData[currentMonth][i] || { open: "", shift: "", t20: "", dish: "", clean: "", close: "" };

        const tr = document.createElement('tr');
        if (isWeekend) tr.classList.add("is-weekend");
        if (isTodayRow) tr.classList.add("is-today");

        const dateDisplay = `${currentMonth + 1}/${i}`;
        
        tr.innerHTML = `
            <td data-label="Date">
                <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-700 text-lg md:text-base">${dateDisplay}</span>
                    <span class="md:hidden text-sm text-slate-400 font-normal ml-2">${weekNamesZh[dayIdx]}</span>
                </div>
                ${isTodayRow ? '<span class="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full font-bold uppercase md:hidden">Today</span>' : ''}
            </td>
            <td data-label="Day" class="md:text-center text-slate-500 font-medium hidden md:table-cell">
                ${weekNames[dayIdx]}
            </td>
            <td data-label="開店" contenteditable="true" class="editable text-center" oninput="updateData(${i}, 'open', this.innerText)">${dayData.open || ''}</td>
            <td data-label="當天值班" contenteditable="true" class="editable text-center font-medium text-slate-700" oninput="updateData(${i}, 'shift', this.innerText)">${dayData.shift || ''}</td>
            <td data-label="20:00" contenteditable="true" class="editable text-center" oninput="updateData(${i}, 't20', this.innerText)">${dayData.t20 || ''}</td>
            <td data-label="關帳" contenteditable="true" class="editable text-center" oninput="updateData(${i}, 'close', this.innerText)">${dayData.close || ''}</td>
            <td data-label="洗餐具" contenteditable="true" class="editable text-center" oninput="updateData(${i}, 'dish', this.innerText)">${dayData.dish || ''}</td>
            <td data-label="清潔事項" contenteditable="true" class="editable text-center" oninput="updateData(${i}, 'clean', this.innerText)">${dayData.clean || ''}</td>
        `;
        scheduleBody.appendChild(tr);
    });

    if (targetDays.length === 0) emptyState.classList.remove('hidden');
    else emptyState.classList.add('hidden');
}

// --- 資料更新與雲端同步 ---
function updateData(day, field, val) {
    if (!fullYearData[currentMonth]) fullYearData[currentMonth] = {};
    if (!fullYearData[currentMonth][day]) fullYearData[currentMonth][day] = {};
    fullYearData[currentMonth][day][field] = val;

    autoSaveIndicator.classList.add('opacity-100');
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => { 
        saveAllToCloud(); 
        autoSaveIndicator.classList.remove('opacity-100');
    }, 800);
}

async function saveAllToCloud() {
    localStorage.setItem(storageKey, JSON.stringify(fullYearData));
    if (CLOUD_API_URL.includes("YOUR_GOOGLE")) return;
    try {
        await fetch(CLOUD_API_URL, {
            method: 'POST', mode: 'no-cors', body: JSON.stringify(fullYearData)
        });
        showToast("已同步至雲端");
    } catch (e) { console.error("Sync failed", e); }
}

async function fetchFromCloud() {
    if (CLOUD_API_URL.includes("YOUR_GOOGLE")) return;
    const statusText = document.getElementById('statusText');
    statusText.innerText = "Syncing...";
    try {
        const res = await fetch(CLOUD_API_URL);
        const data = await res.json();
        if (data && Object.keys(data).length > 0) {
            fullYearData = data;
            localStorage.setItem(storageKey, JSON.stringify(fullYearData));
            renderTable();
            statusText.innerText = "Cloud Synced";
        }
    } catch (e) { statusText.innerText = "Offline Mode"; }
}

// --- 個人排班統計功能 ---
function showMonthStats() {
    document.getElementById('stats-name-input').value = "";
    document.getElementById('stats-result-section').classList.add('hidden');
    const monthName = document.getElementById('monthSelect').selectedOptions[0].text;
    document.getElementById('modal-title').innerText = `${monthName} 統計`;
    document.getElementById('statsModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('stats-name-input').focus(), 100);
    lucide.createIcons();
}

function calculatePersonalStats() {
    const targetName = document.getElementById('stats-name-input').value.trim();
    if (!targetName) { alert("請輸入姓名！"); return; }

    const daysCount = new Date(year, currentMonth + 1, 0).getDate();
    let stats = { shift: 0, open: 0, close: 0, clean: 0 };
    
    for(let i=1; i<=daysCount; i++) {
        const d = fullYearData[currentMonth]?.[i];
        if(d) {
            if(d.shift && d.shift.includes(targetName)) stats.shift++;
            if(d.open && d.open.includes(targetName)) stats.open++;
            if(d.close && d.close.includes(targetName)) stats.close++;
            if((d.dish && d.dish.includes(targetName)) || (d.clean && d.clean.includes(targetName))) stats.clean++;
        }
    }

    document.getElementById('modal-shift-count').innerText = stats.shift;
    document.getElementById('modal-open-count').innerText = stats.open;
    document.getElementById('modal-close-count').innerText = stats.close;
    document.getElementById('modal-clean-count').innerText = stats.clean;
    const percentage = Math.round((stats.shift / daysCount) * 100);
    document.getElementById('modal-coverage').innerText = `${percentage}% (排班天數/當月總天數)`;
    document.getElementById('stats-result-section').classList.remove('hidden');
    const progressBar = document.getElementById('modal-progress-bar');
    progressBar.style.width = '0%';
    setTimeout(() => progressBar.style.width = `${percentage}%`, 100);
}

function closeModal() {
    document.getElementById('statsModal').classList.add('hidden');
}

// --- 月份連動休假表功能 ---
function showLeaveSchedule() {
    const monthName = document.getElementById('monthSelect').selectedOptions[0].text;
    const imgElement = document.getElementById('leaveScheduleImg');
    const noImgMsg = document.getElementById('noLeaveImgMsg');
    
    // 更新視窗標題
    document.getElementById('leaveModalMonthTitle').innerText = `${monthName} 員工休假表`;

    // 取得當前選擇月份的圖片網址
    const currentImgUrl = leaveImages[currentMonth];

    // 判斷該月份是否有設定圖片
    if (currentImgUrl && currentImgUrl.trim() !== "") {
        imgElement.src = currentImgUrl;
        imgElement.classList.remove('hidden');
        noImgMsg.classList.add('hidden');
    } else {
        imgElement.src = "";
        imgElement.classList.add('hidden');
        noImgMsg.classList.remove('hidden');
        lucide.createIcons(); 
    }

    document.getElementById('leaveScheduleModal').classList.remove('hidden');
    lucide.createIcons();
}

function closeLeaveSchedule() {
    document.getElementById('leaveScheduleModal').classList.add('hidden');
}

// --- 通用通知元件 ---
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// 執行初始化
init();