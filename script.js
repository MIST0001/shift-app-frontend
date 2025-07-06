// 1. バックエンドAPIのURLを定義
// 必ず、末尾に /api/shifts をつけてください！
const API_URL = "https://shift-app-api-xgls.onrender.com/api/shifts"; // ← あなたのURLに書き換える！

// 2. HTMLの要素を取得
// id="shift-list" を持つul要素を、プログラムで操作できるように準備します。
const shiftListElement = document.getElementById("shift-list");

// 3. APIからシフトデータを取得して表示する関数
async function fetchAndDisplayShifts() {
    try {
        // APIにアクセスして、データを取得
        const response = await fetch(API_URL);
        const shifts = await response.json(); // データをJSON形式からJavaScriptのオブジェクトに変換

        // 最初に表示されていた「読み込み中...」の表示を消す
        shiftListElement.innerHTML = "";

        // 取得したシフトデータを1件ずつループして、HTMLのリスト項目(li)を作成
        shifts.forEach(shift => {
            // li要素を新しく作成
            const listItem = document.createElement("li");
            
            // li要素の中に表示するテキストを設定
            listItem.textContent = `${shift.date} | ${shift.staff_name} | ${shift.shift_type}`;
            
            // ul要素(shiftListElement)の中に、作成したli要素を追加
            shiftListElement.appendChild(listItem);
        });

    } catch (error) {
        // エラーが発生した場合の処理
        shiftListElement.innerHTML = "<li>エラーが発生しました。データの読み込みに失敗しました。</li>";
        console.error("Fetch error:", error);
    }
}

// 4. ページが読み込まれたら、上記の関数を実行
fetchAndDisplayShifts();
