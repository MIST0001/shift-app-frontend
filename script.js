// --- 設定 ---
const API_URL_BASE = "https://shift-app-api-xgls.onrender.com";
const GET_DATA_URL = `${API_URL_BASE}/api/shift-data`;
const ADD_SHIFT_URL = `${API_URL_BASE}/api/shifts/add`;
const UPDATE_SHIFT_URL_TEMPLATE = `${API_URL_BASE}/api/shifts/update/`;
const DELETE_SHIFT_URL_TEMPLATE = `${API_URL_BASE}/api/shifts/delete/`;

const SHIFT_DEFINITIONS = {
    "早": { type: 'day_work', hours: 8 }, "日1": { type: 'day_work', hours: 8 }, "日2": { type: 'day_work', hours: 8 },
    "中": { type: 'day_work', hours: 8 }, "遅": { type: 'day_work', hours: 8 }, "夜": { type: 'night_work', hours: 16 },
    "明": { type: 'day_work', hours: 0 }, "休": { type: 'holiday', hours: 0 }, "有": { type: 'paid_holiday', hours: 0 }
};
const SUMMARY_ORDER = ["早", "日1", "日2", "中", "遅", "夜", "明", "日勤時間数", "夜勤時間数", "休", "有"];

// --- 状態管理 ---
let currentDate = new Date();
let isAccordionOpen = false;
let currentShifts = [];

// --- DOM要素 ---
let tableHeader, tableBody, modalBackground, modalContent, modalTitle, modalBody, modalCloseBtn, shiftDetailView, shiftAddForm, calendarTitle, prevMonthBtn, nextMonthBtn, todayBtn;

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements();
    setupEventListeners();
    buildShiftTable();
});

function initializeDOMElements() {
    tableHeader = document.getElementById("table-header");
    tableBody = document.getElementById("table-body");
    // ... (他の要素も同様に取得)
    modalBackground = document.getElementById("modal-background");
    modalContent = document.getElementById("modal-content");
    modalTitle = document.getElementById("modal-title");
    modalBody = document.getElementById("modal-body");
    modalCloseBtn = document.getElementById("modal-close-btn");
    shiftDetailView = document.getElementById("shift-detail-view");
    shiftAddForm = document.getElementById("shift-add-form");
    calendarTitle = document.getElementById("calendar-title");
    prevMonthBtn = document.getElementById("prev-month-btn");
    nextMonthBtn = document.getElementById("next-month-btn");
    todayBtn = document.getElementById("today-btn");
}

function setupEventListeners() {
    // ポップアップやナビゲーションのリスナー
    modalCloseBtn.addEventListener('click', closeModal);
    modalBackground.addEventListener('click', closeModal);
    shiftAddForm.addEventListener('submit', handleFormSubmit);
    prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); buildShiftTable(); });
    nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); buildShiftTable(); });
    todayBtn.addEventListener('click', () => { currentDate = new Date(); buildShiftTable(); });

    // イベント委任でアコーディオンのクリックを処理
    tableHeader.addEventListener('click', (event) => {
        if (event.target.id === 'accordion-toggle') {
            isAccordionOpen = !isAccordionOpen;
            buildShiftTable();
        }
    });

    // イベント委任でセルのクリックを処理
    tableBody.addEventListener('click', (event) => {
        const cell = event.target.closest('td');
        if (!cell) return;

        if (cell.classList.contains('has-shift')) {
            const shiftId = parseInt(cell.dataset.shiftId, 10);
            const selectedShift = currentShifts.find(s => s.id === shiftId);
            if (selectedShift) openDetailModal(selectedShift);
        } else if (cell.classList.contains('empty-cell')) {
            const { date, staffId, staffName } = cell.dataset;
            openAddModal(staffId, staffName, date);
        }
    });
}


// --- メイン描画処理 ---
async function buildShiftTable() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    calendarTitle.textContent = `${year}年 ${month}月`;
    tableBody.innerHTML = `<tr><td colspan="40">読み込み中...</td></tr>`;

    const { staff, shifts } = await fetchData(year, month);
    if (!staff || staff.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="40">スタッフデータがありません。</td></tr>`;
        return;
    }
    
    currentShifts = shifts;
    const shiftMap = transformShiftsToMap(shifts);
    const daysInMonth = new Date(year, month, 0).getDate();

    // ヘッダー生成
    let headerHTML = `<tr><th class="header-staff-col">氏名</th>`;
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        headerHTML += `<th class="${date.getDay() === 0 ? "day-sunday" : date.getDay() === 6 ? "day-saturday" : ""}">${day}<br>${weekdays[date.getDay()]}</th>`;
    }
    headerHTML += `<th class="summary-main-header"><div class="summary-header-container"><span>総時間</span><button id="accordion-toggle" class="accordion-toggle">${isAccordionOpen ? '−' : '+'}</button></div></th>`;
    SUMMARY_ORDER.forEach(key => {
        headerHTML += `<th class="summary-detail-header ${isAccordionOpen ? 'visible' : ''}">${key}</th>`;
    });
    tableHeader.innerHTML = headerHTML + `</tr>`;

    // ボディ生成
    let bodyHTML = "";
    staff.forEach(staffMember => {
        const summary = calculateSummary(shifts.filter(s => s.staff_name === staffMember.name));
        bodyHTML += `<tr><td class="staff-name-col">${staffMember.name}</td>`;
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const shiftData = shiftMap[staffMember.name]?.[dateStr];
            if (shiftData) {
                bodyHTML += `<td class="shift-cell has-shift" data-shift-id="${shiftData.id}">${shiftData.shift_type}</td>`;
            } else {
                bodyHTML += `<td class="shift-cell empty-cell" data-date="${dateStr}" data-staff-id="${staffMember.id}" data-staff-name="${staffMember.name}"></td>`;
            }
        }
        const totalHours = summary['日勤時間数'] + summary['夜勤時間数'];
        bodyHTML += `<td class="summary-main-col">${totalHours}h</td>`;
        SUMMARY_ORDER.forEach(key => {
            const value = summary[key] || 0;
            const unit = key.includes('時間数') ? 'h' : '';
            bodyHTML += `<td class="summary-detail-col ${isAccordionOpen ? 'visible' : ''}">${value}${unit}</td>`;
        });
        bodyHTML += `</tr>`;
    });
    tableBody.innerHTML = bodyHTML;
}


// --- ヘルパー関数群 ---
// (ここに、以前の完成版から handleFormSubmit, モーダル関連, API通信, データ変換の各関数をそのままコピー＆ペーストします)
// (コードが長くなりすぎるため、この回答では省略しますが、必ず全ての関数を移植してください)
// --- 実行はDOMContentLoadedに集約済み ---

function calculateSummary(staffShifts) {
    const summary = {};
    // まず全項目を0で初期化
    SUMMARY_ORDER.forEach(key => summary[key] = 0);

    staffShifts.forEach(shift => {
        const def = SHIFT_DEFINITIONS[shift.shift_type];
        if (def) {
            // 各シフトタイプの回数をカウント
            if(summary[shift.shift_type] !== undefined) {
                summary[shift.shift_type]++;
            }

            // 時間数を集計
            if (def.type === 'day_work') {
                summary['日勤時間数'] += def.hours;
            } else if (def.type === 'night_work') {
                summary['夜勤時間数'] += def.hours;
            }
        }
    });
    return summary;
}

function setupCellClickEvents() {
    document.querySelectorAll('.has-shift').forEach(cell => {
        cell.addEventListener('click', (event) => {
            const shiftId = parseInt(event.target.dataset.shiftId, 10);
            const selectedShift = currentShifts.find(s => s.id === shiftId);
            if (selectedShift) openDetailModal(selectedShift);
        });
    });
    document.querySelectorAll('.empty-cell').forEach(cell => {
        cell.addEventListener('click', (event) => {
            const { date, staffId, staffName } = event.target.dataset;
            openAddModal(staffId, staffName, date);
        });
    });
}
async function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const shiftId = form.dataset.shiftId;
    let success = false;
    if (shiftId) {
        const shiftData = { shift_type: document.getElementById('form-shift-type').value, notes: document.getElementById('form-notes').value };
        success = await updateShiftData(shiftId, shiftData);
    } else {
        const shiftData = { staff_id: document.getElementById('form-staff-id').value, date: document.getElementById('form-date').textContent, shift_type: document.getElementById('form-shift-type').value, notes: document.getElementById('form-notes').value };
        success = await addShiftData(shiftData);
    }
    if (success) {
        closeModal();
        buildShiftTable();
    } else {
        alert(`シフトの${shiftId ? '更新' : '登録'}に失敗しました。`);
    }
}
function openDetailModal(shift) {
    shiftAddForm.style.display = 'none';
    shiftDetailView.style.display = 'block';
    modalTitle.textContent = `${shift.date} のシフト詳細`;
    shiftDetailView.innerHTML = `<p><strong>スタッフ:</strong> ${shift.staff_name}</p><p><strong>勤務種類:</strong> ${shift.shift_type}</p><p><strong>備考:</strong> ${shift.notes || '特になし'}</p><div class="modal-buttons"><button id="edit-shift-btn">編集</button><button id="delete-shift-btn" class="delete-btn">削除</button></div>`;
    document.getElementById('edit-shift-btn').addEventListener('click', () => { openEditModal(shift); });
    document.getElementById('delete-shift-btn').addEventListener('click', async () => {
        if (confirm('このシフトを本当に削除しますか？')) {
            const success = await deleteShiftData(shift.id);
            if (success) { closeModal(); buildShiftTable(); } else { alert('シフトの削除に失敗しました。'); }
        }
    });
    modalBackground.classList.add('is-visible');
    modalContent.classList.add('is-visible');
}
function openAddModal(staffId, staffName, date) {
    shiftDetailView.style.display = 'none';
    shiftAddForm.style.display = 'block';
    modalTitle.textContent = '新規シフト登録';
    shiftAddForm.dataset.shiftId = '';
    document.getElementById('form-staff-name').textContent = staffName;
    document.getElementById('form-date').textContent = date;
    document.getElementById('form-staff-id').value = staffId;
    document.getElementById('form-shift-type').value = '日1';
    document.getElementById('form-notes').value = '';
    document.getElementById('form-staff-name').parentElement.style.display = 'block';
    document.getElementById('form-date').parentElement.style.display = 'block';
    modalBackground.classList.add('is-visible');
    modalContent.classList.add('is-visible');
}
function openEditModal(shift) {
    shiftDetailView.style.display = 'none';
    shiftAddForm.style.display = 'block';
    modalTitle.textContent = 'シフト編集';
    shiftAddForm.dataset.shiftId = shift.id;
    document.getElementById('form-staff-name').textContent = shift.staff_name;
    document.getElementById('form-date').textContent = shift.date;
    document.getElementById('form-shift-type').value = shift.shift_type;
    document.getElementById('form-notes').value = shift.notes || '';
    document.getElementById('form-staff-name').parentElement.style.display = 'block';
    document.getElementById('form-date').parentElement.style.display = 'block';
}
function closeModal() {
    modalBackground.classList.remove('is-visible');
    modalContent.classList.remove('is-visible');
}
async function fetchData(year, month) {
    try {
        const response = await fetch(`${GET_DATA_URL}?year=${year}&month=${month}`);
        if (!response.ok) throw new Error('API request failed');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch data:', error);
        return { staff: [], shifts: [] };
    }
}
async function addShiftData(shiftData) {
    try {
        const response = await fetch(ADD_SHIFT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(shiftData) });
        if (!response.ok) throw new Error('API request failed');
        return true;
    } catch (error) {
        console.error('Failed to add shift:', error);
        return false;
    }
}
async function updateShiftData(shiftId, shiftData) {
    try {
        const response = await fetch(`${UPDATE_SHIFT_URL_TEMPLATE}${shiftId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(shiftData) });
        if (!response.ok) throw new Error('API request failed');
        return true;
    } catch (error) {
        console.error('Failed to update shift:', error);
        return false;
    }
}
async function deleteShiftData(shiftId) {
    try {
        const response = await fetch(`${DELETE_SHIFT_URL_TEMPLATE}${shiftId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('API request failed');
        return true;
    } catch (error) {
        console.error('Failed to delete shift:', error);
        return false;
    }
}
function transformShiftsToMap(shifts) {
    const map = {};
    shifts.forEach(shift => {
        if (!map[shift.staff_name]) { map[shift.staff_name] = {}; }
        map[shift.staff_name][shift.date] = shift;
    });
    return map;
}
