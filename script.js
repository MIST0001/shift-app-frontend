// --- 設定 ---
const API_URL = "https://shift-app-api-xgls.onrender.com/api/shift-data"; // ← あなたのURLに書き換える！
const YEAR = 2025;
const MONTH = 7;

// --- 要素の取得 ---
const tableHeader = document.getElementById("table-header");
const tableBody = document.getElementById("table-body");
// ★★★ ポップアップ関連の要素を取得 ★★★
const modalBackground = document.getElementById("modal-background");
const modalContent = document.getElementById("modal-content");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const modalCloseBtn = document.getElementById("modal-close-btn");

// --- メイン処理 ---
async function buildShiftTable() {
    const { staff, shifts } = await fetchData();
    if (!staff || !shifts) return;

    const shiftMap = transformShiftsToMap(shifts); // 今回はデータ全体を保持
    const daysInMonth = new Date(YEAR, MONTH, 0).getDate();

    // 1. ヘッダーを生成 (変更なし)
    let headerHTML = `<tr><th class="header-staff-col">氏名</th>`;
    let dayOfWeekHTML = `<tr><th class="header-staff-col"></th>`;
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(YEAR, MONTH - 1, day);
        const dayOfWeek = date.getDay();
        const dayClass = dayOfWeek === 0 ? "day-sunday" : dayOfWeek === 6 ? "day-saturday" : "";
        headerHTML += `<th class="${dayClass}">${day}</th>`;
        dayOfWeekHTML += `<th class="${dayClass}">${weekdays[dayOfWeek]}</th>`;
    }
    headerHTML += `</tr>`;
    dayOfWeekHTML += `</tr>`;
    tableHeader.innerHTML = headerHTML + dayOfWeekHTML;

    // 2. ボディ（スタッフの行）を生成
    let bodyHTML = "";
    staff.forEach(staffMember => {
        bodyHTML += `<tr><td class="staff-name-col">${staffMember.name}</td>`;
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${YEAR}-${String(MONTH).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const shiftData = shiftMap[staffMember.name]?.[dateStr]; // シフトデータを丸ごと取得
            
            const dayClass = new Date(YEAR, MONTH - 1, day).getDay() === 0 ? "day-sunday" : new Date(YEAR, MONTH - 1, day).getDay() === 6 ? "day-saturday" : "";
            
            if (shiftData) {
                // ★★★ シフトがあるセルに、クリックイベント用の情報を埋め込む ★★★
                bodyHTML += `<td class="shift-cell has-shift ${dayClass}" data-shift-id="${shiftData.id}">${shiftData.shift_type}</td>`;
            } else {
                bodyHTML += `<td class="${dayClass}"></td>`; // シフトがないセル
            }
        }
        bodyHTML += `</tr>`;
    });
    tableBody.innerHTML = bodyHTML;

    // 3. ★★★ すべてのシフトセルにクリックイベントを設定 ★★★
    document.querySelectorAll('.has-shift').forEach(cell => {
        cell.addEventListener('click', (event) => {
            const shiftId = parseInt(event.target.dataset.shiftId, 10);
            const selectedShift = shifts.find(s => s.id === shiftId);
            if (selectedShift) {
                openModal(selectedShift);
            }
        });
    });
}

// --- ヘルパー関数 ---
async function fetchData() { /* ...変更なし... */ }
function transformShiftsToMap(shifts) { /* ...変更なし... */ }

// ★★★ ポップアップを開く関数 ★★★
function openModal(shift) {
    modalTitle.textContent = `${shift.date} のシフト詳細`;
    modalBody.innerHTML = `
        <p><strong>スタッフ:</strong> ${shift.staff_name}</p>
        <p><strong>勤務種類:</strong> ${shift.shift_type}</p>
        <p><strong>備考:</strong> ${shift.notes || '特になし'}</p>
    `;
    modalBackground.classList.add('is-visible');
    modalContent.classList.add('is-visible');
}

// ★★★ ポップアップを閉じる関数 ★★★
function closeModal() {
    modalBackground.classList.remove('is-visible');
    modalContent.classList.remove('is-visible');
}

// --- イベントリスナー ---
// ★★★ 閉じるボタンと背景クリックでポップアップを閉じる ★★★
modalCloseBtn.addEventListener('click', closeModal);
modalBackground.addEventListener('click', closeModal);


// --- 実行 ---
buildShiftTable();

// 変更なしの関数をここにコピー
async function fetchData() { try { const response = await fetch(API_URL); if (!response.ok) throw new Error('API Error'); return await response.json(); } catch (error) { console.error("Fetch error:", error); tableBody.innerHTML = `<tr><td>データ取得エラー</td></tr>`; return {}; } }
function transformShiftsToMap(shifts) { const map = {}; shifts.forEach(shift => { if (!map[shift.staff_name]) { map[shift.staff_name] = {}; } map[shift.staff_name][shift.date] = shift; }); return map; }
