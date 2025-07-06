// --- 設定 ---
const API_URL = "https://shift-app-api-xgls.onrender.com/api/shifts"; // ← あなたのURLに書き換える！
const YEAR = 2025;
const MONTH = 7; // 7月 (JavaScriptでは月は0から始まるので、内部的には6として扱います)

// --- 要素の取得 ---
const calendarBody = document.getElementById("calendar-body");

// --- メインの処理 ---
async function generateCalendar() {
    // 1. バックエンドからシフトデータを取得
    const shiftsData = await fetchShifts();

    // 2. カレンダーのHTMLを生成
    // まず、月の初日と末日、初日の曜日を取得
    const firstDay = new Date(YEAR, MONTH - 1, 1);
    const lastDay = new Date(YEAR, MONTH, 0);
    const firstDayOfWeek = firstDay.getDay(); // 0:日曜, 1:月曜...

    let calendarHTML = "<tr>";
    
    // 1日の前の空白セルを生成
    for (let i = 0; i < firstDayOfWeek; i++) {
        calendarHTML += "<td></td>";
    }

    // 1日から末日まで日付セルを生成
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const currentDate = new Date(YEAR, MONTH - 1, day);
        const dayOfWeek = currentDate.getDay();
        const dateString = `${YEAR}-${String(MONTH).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // その日のシフトデータをフィルタリング
        const shiftsForDay = shiftsData.filter(s => s.date === dateString);

        // セルの中身を生成
        calendarHTML += `<td>`;
        calendarHTML += `<div class="date-number ${getDayClass(dayOfWeek)}">${day}</div>`;
        calendarHTML += `<div class="shifts-container">`;
        shiftsForDay.forEach(shift => {
            calendarHTML += `<div class="shift-item">${shift.staff_name} (${shift.shift_type})</div>`;
        });
        calendarHTML += `</div>`;
        calendarHTML += `</td>`;

        // 土曜日だったら行を閉じて、新しい行を開始
        if (dayOfWeek === 6) {
            calendarHTML += "</tr><tr>";
        }
    }
    
    // 月の末日の後の空白セルを生成
    const lastDayOfWeek = lastDay.getDay();
    for (let i = lastDayOfWeek; i < 6; i++) {
        calendarHTML += "<td></td>";
    }
    calendarHTML += "</tr>";

    // 3. 生成したHTMLをカレンダーのtbodyに挿入
    calendarBody.innerHTML = calendarHTML;
}

// --- ヘルパー関数 ---

// APIからデータを取得する関数
async function fetchShifts() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error('APIからのデータ取得に失敗しました');
        }
        return await response.json();
    } catch (error) {
        console.error("Fetch error:", error);
        return []; // エラーの場合は空の配列を返す
    }
}

// 曜日に応じてCSSクラスを返す関数 (土日の色分け用)
function getDayClass(dayOfWeek) {
    if (dayOfWeek === 0) return 'sunday';
    if (dayOfWeek === 6) return 'saturday';
    return '';
}

// --- 実行 ---
generateCalendar();
