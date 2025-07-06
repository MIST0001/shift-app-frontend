// =================================================================================
// --- 設定 (Settings) ---
// =================================================================================

const API_URL_BASE = "https://shift-app-api-xgls.onrender.com";

// シフト関連API
const GET_DATA_URL = `${API_URL_BASE}/api/shift-data`;
const ADD_SHIFT_URL = `${API_URL_BASE}/api/shifts/add`;
const UPDATE_SHIFT_URL_TEMPLATE = `${API_URL_BASE}/api/shifts/update/`;
const DELETE_SHIFT_URL_TEMPLATE = `${API_URL_BASE}/api/shifts/delete/`;

// スタッフ関連API
const ADD_STAFF_URL = `${API_URL_BASE}/api/staff/add`;
const UPDATE_STAFF_URL_TEMPLATE = `${API_URL_BASE}/api/staff/update/`;
const DELETE_STAFF_URL_TEMPLATE = `${API_URL_BASE}/api/staff/delete/`;

// シフト定義
const SHIFT_DEFINITIONS = {
    "早": { type: 'day_work', hours: 8 }, "日1": { type: 'day_work', hours: 8 }, "日2": { type: 'day_work', hours: 8 },
    "中": { type: 'day_work', hours: 8 }, "遅": { type: 'day_work', hours: 8 }, "夜": { type: 'night_work', hours: 16 },
    "明": { type: 'day_work', hours: 0 }, "休": { type: 'holiday', hours: 0 }, "有": { type: 'paid_holiday', hours: 0 }
};

// 集計表の表示順
const SUMMARY_ORDER = ["早", "日1", "日2", "中", "遅", "夜", "明", "日勤時間数", "夜勤時間数", "休", "有"];


// =================================================================================
// --- 状態管理 (State Management) ---
// =================================================================================

let currentDate = new Date();
let isAccordionOpen = false;
let currentShifts = [];
let currentStaff = [];


// =================================================================================
// --- DOM要素 (DOM Elements) ---
// =================================================================================

// カレンダー & テーブル
let calendarTitle, prevMonthBtn, nextMonthBtn, todayBtn, tableHeader, tableBody;

// シフト用モーダル
let shiftModalBackground, shiftModalContent, shiftModalTitle, shiftModalBody, shiftModalCloseBtn, shiftDetailView, shiftAddForm;

// スタッフ管理用モーダル
let staffManageBtn, staffModalBackground, staffModalContent, staffModalCloseBtn, staffListContainer, addStaffForm;


// =================================================================================
// --- 初期化 (Initialization) ---
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements();
    setupEventListeners();
    buildShiftTable();
});

/**
 * 全てのDOM要素を取得してグローバル変数に格納する
 */
function initializeDOMElements() {
    // カレンダー & テーブル
    calendarTitle = document.getElementById("calendar-title");
    prevMonthBtn = document.getElementById("prev-month-btn");
    nextMonthBtn = document.getElementById("next-month-btn");
    todayBtn = document.getElementById("today-btn");
    tableHeader = document.getElementById("table-header");
    tableBody = document.getElementById("table-body");

    // シフト用モーダル
    shiftModalBackground = document.getElementById("modal-background");
    shiftModalContent = document.getElementById("modal-content");
    shiftModalTitle = document.getElementById("modal-title");
    shiftModalBody = document.getElementById("modal-body");
    shiftModalCloseBtn = document.getElementById("modal-close-btn");
    shiftDetailView = document.getElementById("shift-detail-view");
    shiftAddForm = document.getElementById("shift-add-form");

    // スタッフ管理用モーダル
    staffManageBtn = document.getElementById("staff-manage-btn");
    staffModalBackground = document.getElementById("staff-modal-background");
    staffModalContent = document.getElementById("staff-modal-content");
    staffModalCloseBtn = document.getElementById("staff-modal-close-btn");
    staffListContainer = document.getElementById("staff-list-container");
    addStaffForm = document.getElementById("add-staff-form");
}

/**
 * 全てのイベントリスナーを設定する
 */
function setupEventListeners() {
    // カレンダーナビゲーション
    prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); buildShiftTable(); });
    nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); buildShiftTable(); });
    todayBtn.addEventListener('click', () => { currentDate = new Date(); buildShiftTable(); });

    // シフト用モーダル
    shiftModalCloseBtn.addEventListener('click', closeShiftModal);
    shiftModalBackground.addEventListener('click', closeShiftModal);
    shiftAddForm.addEventListener('submit', handleShiftFormSubmit);

    // スタッフ管理用モーダル
    staffManageBtn.addEventListener('click', openStaffModal);
    staffModalCloseBtn.addEventListener('click', closeStaffModal);
    staffModalBackground.addEventListener('click', closeStaffModal);
    addStaffForm.addEventListener('submit', handleAddStaff);

    // イベント委任：アコーディオン開閉
    tableHeader.addEventListener('click', (event) => {
        if (event.target.id === 'accordion-toggle') {
            isAccordionOpen = !isAccordionOpen;
            buildShiftTable(); // アコーディオンの状態を反映して再描画
        }
    });

    // イベント委任：シフトセルクリック
    tableBody.addEventListener('click', (event) => {
        const cell = event.target.closest('td');
        if (!cell) return;

        if (cell.classList.contains('has-shift')) {
            const shiftId = parseInt(cell.dataset.shiftId, 10);
            const selectedShift = currentShifts.find(s => s.id === shiftId);
            if (selectedShift) openShiftDetailModal(selectedShift);
        } else if (cell.classList.contains('empty-cell')) {
            const { date, staffId, staffName } = cell.dataset;
            openShiftAddModal(staffId, staffName, date);
        }
    });
}


// =================================================================================
// --- メイン描画処理 (Main Rendering) ---
// =================================================================================

/**
 * サーバーからデータを取得し、シフト表全体を構築・再描画する
 */
async function buildShiftTable() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    calendarTitle.textContent = `${year}年 ${month}月`;
    tableBody.innerHTML = `<tr><td colspan="${33 + SUMMARY_ORDER.length}">読み込み中...</td></tr>`;

    const { staff, shifts } = await fetchData(year, month);
    if (!staff || staff.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${33 + SUMMARY_ORDER.length}">スタッフデータがありません。スタッフを登録してください。</td></tr>`;
        return;
    }
    
    currentStaff = staff;
    currentShifts = shifts;
    const shiftMap = transformShiftsToMap(shifts);
    const daysInMonth = new Date(year, month, 0).getDate();

    // ヘッダー生成
    buildTableHeader(year, month, daysInMonth);

    // ボディ生成
    buildTableBody(staff, shifts, shiftMap, year, month, daysInMonth);
}

/**
 * シフト表のヘッダーを生成する
 */
function buildTableHeader(year, month, daysInMonth) {
    let headerHTML = `<tr><th class="header-staff-col">氏名</th>`;
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dayClass = date.getDay() === 0 ? "day-sunday" : date.getDay() === 6 ? "day-saturday" : "";
        headerHTML += `<th class="${dayClass}">${day}<br>${weekdays[date.getDay()]}</th>`;
    }
    headerHTML += `<th class="summary-main-header"><div class="summary-header-container"><span>総時間</span><button id="accordion-toggle" class="accordion-toggle">${isAccordionOpen ? '−' : '+'}</button></div></th>`;
    SUMMARY_ORDER.forEach(key => {
        headerHTML += `<th class="summary-detail-header ${isAccordionOpen ? 'visible' : ''}">${key}</th>`;
    });
    tableHeader.innerHTML = headerHTML + `</tr>`;
}

/**
 * シフト表のボディ（各スタッフの行）を生成する
 */
function buildTableBody(staff, shifts, shiftMap, year, month, daysInMonth) {
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


// =================================================================================
// --- シフト関連モーダル (Shift Modals) ---
// =================================================================================

function openShiftDetailModal(shift) {
    shiftAddForm.style.display = 'none';
    shiftDetailView.style.display = 'block';
    shiftModalTitle.textContent = `${shift.date} のシフト詳細`;
    shiftDetailView.innerHTML = `<p><strong>スタッフ:</strong> ${shift.staff_name}</p><p><strong>勤務種類:</strong> ${shift.shift_type}</p><p><strong>備考:</strong> ${shift.notes || '特になし'}</p><div class="modal-buttons"><button id="edit-shift-btn">編集</button><button id="delete-shift-btn" class="delete-btn">削除</button></div>`;
    
    document.getElementById('edit-shift-btn').addEventListener('click', () => openShiftEditModal(shift));
    document.getElementById('delete-shift-btn').addEventListener('click', async () => {
        if (confirm('このシフトを本当に削除しますか？')) {
            const success = await deleteShiftApi(shift.id);
            if (success) { closeShiftModal(); buildShiftTable(); } else { alert('シフトの削除に失敗しました。'); }
        }
    });
    
    shiftModalBackground.classList.add('is-visible');
    shiftModalContent.classList.add('is-visible');
}

function openShiftAddModal(staffId, staffName, date) {
    shiftDetailView.style.display = 'none';
    shiftAddForm.style.display = 'block';
    shiftModalTitle.textContent = '新規シフト登録';
    shiftAddForm.dataset.shiftId = '';
    document.getElementById('form-staff-name').textContent = staffName;
    document.getElementById('form-date').textContent = date;
    document.getElementById('form-staff-id').value = staffId;
    document.getElementById('form-shift-type').value = '日1';
    document.getElementById('form-notes').value = '';
    document.getElementById('form-staff-name').parentElement.style.display = 'block';
    document.getElementById('form-date').parentElement.style.display = 'block';
    
    shiftModalBackground.classList.add('is-visible');
    shiftModalContent.classList.add('is-visible');
}

function openShiftEditModal(shift) {
    shiftDetailView.style.display = 'none';
    shiftAddForm.style.display = 'block';
    shiftModalTitle.textContent = 'シフト編集';
    shiftAddForm.dataset.shiftId = shift.id;
    document.getElementById('form-staff-name').textContent = shift.staff_name;
    document.getElementById('form-date').textContent = shift.date;
    document.getElementById('form-shift-type').value = shift.shift_type;
    document.getElementById('form-notes').value = shift.notes || '';
    document.getElementById('form-staff-name').parentElement.style.display = 'block';
    document.getElementById('form-date').parentElement.style.display = 'block';
}

function closeShiftModal() {
    shiftModalBackground.classList.remove('is-visible');
    shiftModalContent.classList.remove('is-visible');
}


// =================================================================================
// --- スタッフ管理モーダル & UI (Staff Management Modal & UI) ---
// =================================================================================

function openStaffModal() {
    renderStaffList();
    staffModalBackground.classList.add('is-visible');
    staffModalContent.classList.add('is-visible');
}

function closeStaffModal() {
    staffModalBackground.classList.remove('is-visible');
    staffModalContent.classList.remove('is-visible');
}

/**
 * 現在のスタッフ一覧をモーダル内に描画する
 */
function renderStaffList() {
    let listHTML = '<ul>';
    currentStaff.forEach(staff => {
        listHTML += `<li>
            <span>${staff.name}</span>
            <div>
                <button onclick="handleEditStaff(${staff.id}, '${staff.name}')">編集</button>
                <button onclick="handleDeleteStaff(${staff.id})" class="delete-btn">削除</button>
            </div>
        </li>`;
    });
    listHTML += '</ul>';
    staffListContainer.innerHTML = listHTML;
}


// =================================================================================
// --- イベントハンドラ (Event Handlers) ---
// =================================================================================

/**
 * シフトの追加・更新フォームの送信を処理する
 */
async function handleShiftFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const shiftId = form.dataset.shiftId;
    let success = false;

    if (shiftId) { // 更新の場合
        const shiftData = { 
            shift_type: document.getElementById('form-shift-type').value, 
            notes: document.getElementById('form-notes').value 
        };
        success = await updateShiftApi(shiftId, shiftData);
    } else { // 新規追加の場合
        const shiftData = { 
            staff_id: document.getElementById('form-staff-id').value, 
            date: document.getElementById('form-date').textContent, 
            shift_type: document.getElementById('form-shift-type').value, 
            notes: document.getElementById('form-notes').value 
        };
        success = await addShiftApi(shiftData);
    }

    if (success) {
        closeShiftModal();
        buildShiftTable();
    } else {
        alert(`シフトの${shiftId ? '更新' : '登録'}に失敗しました。`);
    }
}

/**
 * スタッフ追加フォームの送信を処理する
 */
async function handleAddStaff(event) {
    event.preventDefault();
    const newNameInput = document.getElementById('new-staff-name');
    const newName = newNameInput.value.trim();
    if (!newName) return;
    
    const success = await addStaffApi({ name: newName });
    if (success) {
        newNameInput.value = '';
        await buildShiftTable(); // テーブルを再描画してスタッフ一覧を更新
        renderStaffList();       // モーダル内のリストも更新
    } else {
        alert('スタッフの追加に失敗しました。');
    }
}

/**
 * スタッフ名編集の処理を行う
 */
async function handleEditStaff(staffId, currentName) {
    const newName = prompt('新しいスタッフ名を入力してください:', currentName);
    if (newName && newName.trim() !== '' && newName !== currentName) {
        const success = await updateStaffApi(staffId, { name: newName.trim() });
        if (success) {
            await buildShiftTable();
            renderStaffList();
        } else {
            alert('スタッフ名の更新に失敗しました。');
        }
    }
}

/**
 * スタッフ削除の処理を行う
 */
// handleDeleteStaff 関数を書き換える
async function handleDeleteStaff(staffId) {
    if (confirm('このスタッフを本当に削除しますか？')) {
        const success = await deleteStaffData(staffId, false); // まずは通常削除を試みる
        
        if (success.ok) {
            // 削除成功
            await buildShiftTable();
            renderStaffList();
        } else {
            // 削除失敗
            if (success.data && success.data.needs_confirmation) {
                // バックエンドから「確認が必要」と返ってきた場合
                if (confirm('このスタッフには関連するシフトがあります。\nすべての関連シフトも一緒に削除しますか？\n（この操作は元に戻せません）')) {
                    const forceSuccess = await deleteStaffData(staffId, true); // 次は強制削除を試みる
                    if (forceSuccess.ok) {
                        await buildShiftTable();
                        renderStaffList();
                    } else {
                        alert(`強制削除に失敗しました: ${forceSuccess.data.error}`);
                    }
                }
            } else {
                // その他のエラー
                alert(`スタッフの削除に失敗しました: ${success.data.error}`);
            }
        }
    }
}


// deleteStaffData 関数を書き換える
async function deleteStaffData(staffId, force = false) {
    try {
        // 'force' パラメータをURLに追加
        const url = `${DELETE_STAFF_URL_TEMPLATE}${staffId}${force ? '?force=true' : ''}`;
        
        const response = await fetch(url, {
            method: 'DELETE',
        });

        const responseData = await response.json();

        if (!response.ok) {
            // 200番台以外のステータスコードの場合
            return { ok: false, data: responseData };
        }
        // 成功した場合
        return { ok: true, data: responseData };

    } catch (error) {
        console.error('Failed to delete staff:', error);
        return { ok: false, data: { error: '通信エラーが発生しました。' } };
    }
}


// =================================================================================
// --- API通信 (API Communications) ---
// =================================================================================

// --- Shift API ---
async function fetchData(year, month) {
    try {
        const response = await fetch(`${GET_DATA_URL}?year=${year}&month=${month}`);
        if (!response.ok) throw new Error('API request failed');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch data:', error);
        tableBody.innerHTML = `<tr><td colspan="${33 + SUMMARY_ORDER.length}">データの読み込みに失敗しました。</td></tr>`;
        return { staff: [], shifts: [] };
    }
}

async function addShiftApi(shiftData) {
    return await postData(ADD_SHIFT_URL, shiftData, 'Failed to add shift');
}

async function updateShiftApi(shiftId, shiftData) {
    return await postData(`${UPDATE_SHIFT_URL_TEMPLATE}${shiftId}`, shiftData, 'Failed to update shift', 'PUT');
}

async function deleteShiftApi(shiftId) {
    return await postData(`${DELETE_SHIFT_URL_TEMPLATE}${shiftId}`, null, 'Failed to delete shift', 'DELETE');
}

// --- Staff API ---
async function addStaffApi(staffData) {
    return await postData(ADD_STAFF_URL, staffData, 'Failed to add staff');
}

async function updateStaffApi(staffId, staffData) {
    return await postData(`${UPDATE_STAFF_URL_TEMPLATE}${staffId}`, staffData, 'Failed to update staff', 'PUT');
}

async function deleteStaffApi(staffId) {
    return await postData(`${DELETE_STAFF_URL_TEMPLATE}${staffId}`, null, 'Failed to delete staff', 'DELETE');
}

/**
 * APIへのPOST/PUT/DELETEリクエストを共通化する関数
 */
async function postData(url, data, errorMessage, method = 'POST') {
    try {
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (data) {
            options.body = JSON.stringify(data);
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            console.error(`${errorMessage}: ${errorData.message}`);
            throw new Error(`${errorMessage}: ${errorData.message}`);
        }
        return true;
    } catch (error) {
        console.error(errorMessage, error);
        return false;
    }
}


// =================================================================================
// --- ヘルパー関数 (Helper Functions) ---
// =================================================================================

/**
 * スタッフごとのシフト集計を計算する
 */
function calculateSummary(staffShifts) {
    const summary = {};
    SUMMARY_ORDER.forEach(key => summary[key] = 0); // 全項目を0で初期化

    staffShifts.forEach(shift => {
        const def = SHIFT_DEFINITIONS[shift.shift_type];
        if (def) {
            if(summary[shift.shift_type] !== undefined) {
                summary[shift.shift_type]++;
            }
            if (def.type === 'day_work') {
                summary['日勤時間数'] += def.hours;
            } else if (def.type === 'night_work') {
                summary['夜勤時間数'] += def.hours;
            }
        }
    });
    return summary;
}

/**
 * シフト配列を検索しやすいようにマップ形式に変換する
 * 例: { "スタッフ名": { "YYYY-MM-DD": shiftObject } }
 */
function transformShiftsToMap(shifts) {
    const map = {};
    shifts.forEach(shift => {
        if (!map[shift.staff_name]) { map[shift.staff_name] = {}; }
        map[shift.staff_name][shift.date] = shift;
    });
    return map;
}
