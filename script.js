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
    0: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=1200&auto=format&fit=crop", 
    1: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1000&auto=format&fit=crop", 
    2: "./images/level3.png", 
    3: "", 4: "", 5: "", 6: "", 7: "", 8: "", 9: "", 10: "", 11: ""  
};

// --- 工作崗位表圖片設定 (固定圖片) ---
const STATION_IMAGE_URL = "./images/第四版工作分配表.png";

// --- 全域變數 ---
let currentMonth = new Date().getMonth(); 
let currentView = 'day'; 
let fullYearData = JSON.parse(localStorage.getItem(storageKey)) || {};
let autoSaveTimer = null;
let currentStatsDates = { shift: [], open: [], close: [], clean: [], t20: [] }; 

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
    closeDetailDates(); 
    
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
    let stats = { shift: 0, open: 0, close: 0, clean: 0, t20: 0 };
    
    currentStatsDates = { shift: [], open: [], close: [], clean: [], t20: [] };
    
    for(let i=1; i<=daysCount; i++) {
        const d = fullYearData[currentMonth]?.[i];
        if(d) {
            if(d.shift && d.shift.includes(targetName)) { 
                stats.shift++; currentStatsDates.shift.push({ day: i, content: d.shift }); 
            }
            if(d.open && d.open.includes(targetName)) { 
                stats.open++; currentStatsDates.open.push({ day: i, content: d.open }); 
            }
            if(d.close && d.close.includes(targetName)) { 
                stats.close++; currentStatsDates.close.push({ day: i, content: d.close }); 
            }
            if(d.t20 && d.t20.includes(targetName)) { 
                stats.t20++; currentStatsDates.t20.push({ day: i, content: d.t20 }); 
            }
            
            // 處理清潔與洗餐具
            if((d.dish && d.dish.includes(targetName)) || (d.clean && d.clean.includes(targetName))) { 
                stats.clean++; 
                let cleanDetails = [];
                
                if (d.dish && d.dish.includes(targetName)) {
                    let lines = d.dish.split('\n').filter(l => l.includes(targetName));
                    if(lines.length > 0) cleanDetails.push(`洗餐具：${lines.join(', ')}`);
                }
                
                if (d.clean && d.clean.includes(targetName)) {
                    let lines = d.clean.split('\n');
                    let matchedLines = [];
                    // 檢查「白天/晚上」是否從屬於「玻璃」
                    for(let j=0; j<lines.length; j++) {
                        let line = lines[j];
                        if (line.includes(targetName)) {
                            if ((line.includes('白天') || line.includes('晚上'))) {
                                matchedLines.push(`玻璃 (${line.trim()})`); // 加上「玻璃」前綴以便識別
                            } else {
                                matchedLines.push(line.trim());
                            }
                        }
                    }
                    if(matchedLines.length > 0) cleanDetails.push(matchedLines.join(' | '));
                }
                
                currentStatsDates.clean.push({ day: i, content: cleanDetails.join(' | ') }); 
            }
        }
    }

    document.getElementById('modal-shift-count').innerText = stats.shift;
    document.getElementById('modal-open-count').innerText = stats.open;
    document.getElementById('modal-close-count').innerText = stats.close;
    document.getElementById('modal-clean-count').innerText = stats.clean;
    if (document.getElementById('modal-t20-count')) {
        document.getElementById('modal-t20-count').innerText = stats.t20;
    }

    const percentage = Math.round((stats.shift / daysCount) * 100);
    document.getElementById('modal-coverage').innerText = `${percentage}% (排班天數/當月總天數)`;
    
    closeDetailDates();
    document.getElementById('stats-result-section').classList.remove('hidden');
    const progressBar = document.getElementById('modal-progress-bar');
    progressBar.style.width = '0%';
    setTimeout(() => progressBar.style.width = `${percentage}%`, 100);
}

function showDetailDates(type) {
    const typeNames = { shift: '值班', open: '開店', close: '關帳', clean: '清潔事務', t20: '20:00 排班' };
    const items = currentStatsDates[type];
    const detailSection = document.getElementById('stats-detail-section');
    const titleSpan = document.querySelector('#detail-title span');
    const list = document.getElementById('detail-dates-list');

    titleSpan.innerText = `${typeNames[type]} 詳細日期`;
    list.innerHTML = '';

    if (items.length === 0) {
        list.innerHTML = '<span class="text-slate-400 text-xs py-2 w-full text-center">該項目無排班紀錄</span>';
    } else {
        items.forEach(item => {
            const dateObj = new Date(year, currentMonth, item.day);
            const dayName = weekNamesZh[dateObj.getDay()];
            const span = document.createElement('span');
            
            let displayText = `${currentMonth + 1}/${item.day} (${dayName})`;
            
            if (type === 'clean' && item.content) {
                displayText += ` 👉 ${item.content}`;
                span.className = 'bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg border border-emerald-100 text-xs font-medium tracking-wide w-full flex items-center gap-2 mb-1.5 shadow-sm';
            } else {
                span.className = 'bg-slate-100/80 text-slate-600 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium tracking-wide inline-block mb-1 mr-1';
            }
            
            span.innerText = displayText;
            list.appendChild(span);
        });
    }
    
    detailSection.classList.remove('hidden');
    lucide.createIcons();
}

function closeDetailDates() {
    const detailSection = document.getElementById('stats-detail-section');
    if(detailSection) {
        detailSection.classList.add('hidden');
    }
}

function closeModal() {
    document.getElementById('statsModal').classList.add('hidden');
    closeDetailDates();
}

function showLeaveSchedule() {
    const monthName = document.getElementById('monthSelect').selectedOptions[0].text;
    const imgElement = document.getElementById('leaveScheduleImg');
    const noImgMsg = document.getElementById('noLeaveImgMsg');
    
    document.getElementById('leaveModalMonthTitle').innerText = `${monthName} 員工休假表`;
    const currentImgUrl = leaveImages[currentMonth];

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

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function showStationModal() {
    const imgElement = document.getElementById('stationImg');
    if (!imgElement.src || imgElement.getAttribute('src') === '') {
        imgElement.src = STATION_IMAGE_URL;
    }
    document.getElementById('stationModal').classList.remove('hidden');
    lucide.createIcons();
}

function closeStationModal() {
    document.getElementById('stationModal').classList.add('hidden');
}

// ==========================================
// --- 快捷輸入面板 (Quick Input) 功能 ---
// ==========================================

const QUICK_NAMES = ["可柔", "俐嬅", "小郭", "菟菟", "林宣", "若菱", "祥瑋", "翠翠","Sam" , "偲璇", "X"];
// 【新增】將白天、晚上加入快捷事項
const QUICK_TASKS = ["果汁", "廁所", "刷地", "玻璃", "白天", "晚上"];

let activeCell = null; 

function initQuickInput() {
    const namesContainer = document.getElementById('quick-names-container');
    QUICK_NAMES.forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-600 text-sm rounded-lg border border-slate-200 transition-colors active:scale-95';
        btn.innerText = name;
        btn.onmousedown = (e) => { e.preventDefault(); insertTextToCell(name, 'name'); };
        namesContainer.appendChild(btn);
    });

    const tasksContainer = document.getElementById('quick-tasks-container');
    QUICK_TASKS.forEach(task => {
        const btn = document.createElement('button');
        btn.className = 'px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 text-emerald-600 text-sm rounded-lg border border-emerald-100 transition-colors active:scale-95';
        btn.innerText = task;
        btn.onmousedown = (e) => { e.preventDefault(); insertTextToCell(task, 'task'); };
        tasksContainer.appendChild(btn);
    });

    document.addEventListener('focusin', (e) => {
        if (e.target.classList.contains('editable')) {
            activeCell = e.target;
            showQuickInput(activeCell);
        }
    });

    document.addEventListener('mousedown', (e) => {
        const panel = document.getElementById('quick-input-panel');
        if (!panel.contains(e.target) && !e.target.classList.contains('editable')) {
            closeQuickInput();
        }
    });
    
    window.addEventListener('scroll', closeQuickInput, true);
}

function showQuickInput(cell) {
    const panel = document.getElementById('quick-input-panel');
    const rect = cell.getBoundingClientRect();
    
    let topPos = rect.bottom + 5;
    let leftPos = rect.left;

    if (topPos + 250 > window.innerHeight) {
        topPos = rect.top - panel.offsetHeight - 5; 
    }
    if (leftPos + 280 > window.innerWidth) {
        leftPos = window.innerWidth - 290; 
    }

    panel.style.top = `${topPos}px`;
    panel.style.left = `${leftPos}px`;
    panel.classList.remove('hidden');
    lucide.createIcons();
}

function closeQuickInput() {
    const panel = document.getElementById('quick-input-panel');
    if (panel) panel.classList.add('hidden');
    activeCell = null;
}

// 【優化】玻璃專屬換行排版邏輯
function insertTextToCell(text, type) {
    if (!activeCell) return;

    let currentText = activeCell.innerText; 
    const colLabel = activeCell.getAttribute('data-label');

    if (colLabel === '清潔事項' || colLabel === '洗餐具') {
        if (type === 'task') {
            // 【特別處理「玻璃」】點擊玻璃不加冒號，而是獨立一行
            if (text === '玻璃') {
                if (currentText.trim().length > 0 && !currentText.endsWith('\n')) {
                    activeCell.innerText = currentText.trim() + '\n' + text + '\n';
                } else {
                    activeCell.innerText = currentText + text + '\n';
                }
            } else {
                // 其他事項 (果汁、刷地、白天、晚上等) 正常換行加冒號
                if (currentText.trim().length > 0 && !currentText.endsWith('\n')) {
                    activeCell.innerText = currentText.trim() + '\n' + text + '：';
                } else {
                    activeCell.innerText = currentText + text + '：';
                }
            }
        } else if (type === 'name') {
            if (currentText.endsWith('：')) {
                activeCell.innerText = currentText + text;
            } else {
                activeCell.innerText = currentText + (currentText.trim().length > 0 && !currentText.endsWith('\n') ? '、' : '') + text;
            }
        }
    } else {
        if (currentText.trim().length > 0) {
            if (currentText.endsWith('、') || currentText.endsWith('：') || currentText.endsWith('\n')) {
                activeCell.innerText = currentText + text;
            } else {
                activeCell.innerText = currentText.trim() + '、' + text;
            }
        } else {
            activeCell.innerText = text;
        }
    }

    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(activeCell);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    const inputEvent = new Event('input', { bubbles: true });
    activeCell.dispatchEvent(inputEvent);
}

// 執行快捷輸入的初始化
initQuickInput();

// 執行初始化
init();