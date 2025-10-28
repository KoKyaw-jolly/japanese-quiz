// Global variables
let initialMeaningData = [];
let allVocabulary = {};
let chapterKeys = [];
let currentChapterIndex = 0;

// HTML Elements (Assuming these IDs exist in the HTML structure)
// FIX: Check if elements exist before accessing them, especially outside of DOMContentLoaded
const $select = document.getElementById("chapter-select");
const $tableBody = document.getElementById("vocabulary-table-body");
const $itemCount = document.getElementById("item-count");
const $prevButton = document.getElementById("prev-button");
const $nextButton = document.getElementById("next-button");
const $chapterDisplay = document.getElementById("current-chapter-display");

/**
 * ဝေါဟာရ အချက်အလက်များကို JSON ဖိုင်မှ Fetch လုပ်ယူသည်
 */
function getStartMeaningClick() {
  // NOTE: This will only work if the data.json file exists at the specified relative path.
  fetch("../json/data.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Could not find data.json or network response was not ok.");
      }
      return response.json();
    })
    .then((data) => {
      // FIX: Assign the fetched data (which is already a JS Array)
      initialMeaningData = data;
      console.log("Successfully loaded data. Starting application.");
      
      // Start the application only after data is successfully loaded
      initializeApp(); 
    })
    .catch((error) => {
      console.error("Error loading data:", error);
      // Display a friendly error message if data fails to load
      displayError('Failed to load quiz data. Please ensure "../json/data.json" exists and is correctly formatted.');
    });
}

/**
 * ဝေါဟာရ အချက်အလက်များကို Chapter အလိုက် အုပ်စုဖွဲ့သည်
 */
function loadVocabularyData() {
  try {
    // FIX: Use the fetched array (initialMeaningData) and group it by 'chapter' key
    const dataArray = initialMeaningData;

    // Group the flat array into an object by chapter key
    allVocabulary = dataArray.reduce((acc, item) => {
      const chapterKey = item.chapter || 'No Chapter';
      if (!acc[chapterKey]) {
        acc[chapterKey] = [];
      }
      acc[chapterKey].push(item);
      return acc;
    }, {});
    
    // Chapter keys များကို စီခြင်း (e.g., Ch-1, Ch-2, ...)
    chapterKeys = Object.keys(allVocabulary).sort(); 

    if (chapterKeys.length > 0) {
      currentChapterIndex = 0; // ပထမဆုံး Chapter မှ စတင်သည်။
    } else {
      displayError("ဝေါဟာရ အချက်အလက်များ မတွေ့ရှိပါ (JSON is empty or missing 'chapter' key).");
    }
  } catch (error) {
    console.error("Error loading or parsing vocabulary data:", error);
    displayError(
      "အချက်အလက်များကို ခွဲခြမ်းစိတ်ဖြာရာတွင် အမှားဖြစ်ပွားသည်: " +
        error.message
    );
  }
}

/**
 * လက်ရှိ Chapter အတွက် ဝေါဟာရ ဇယားကို Render လုပ်ခြင်း
 */
function renderVocabularyTable(chapterKey) {
  const data = allVocabulary[chapterKey] || [];

  // ဇယားကို ရှင်းလင်းခြင်း
  if (!$tableBody) return;
  $tableBody.innerHTML = "";

  if (data.length === 0) {
    $tableBody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-gray-500 font-medium">ဤ Chapter တွင် ဝေါဟာရများ မရှိပါ။</td></tr>`;
    $itemCount.textContent = 0;
    return;
  }

  // Data ကို Loop ပတ်ပြီး ဇယားတန်းများ ဖန်တီးခြင်း
  data.forEach((item, index) => {
    const row = document.createElement("tr");

    // တစ်တန်းခြားစီ နောက်ခံအရောင်ပြောင်းခြင်း (Zebra Striping)
    row.className =
      index % 2 === 0
        ? "hover:bg-gray-50 transition-colors"
        : "bg-gray-50 hover:bg-gray-100 transition-colors";

    // ပင်မ စာလုံး (ဟိရဂန/ခတကန) ကို တွဲပြခြင်း
    const japaneseScript =
      item.hirakana && item.katakana
        ? `${item.hirakana} (${item.katakana})`
        : item.hirakana || item.katakana || "-";

    row.innerHTML = `
        <td class="table-cell font-bold text-gray-800 text-lg">
          ${japaneseScript}
        </td>
        <td class="table-cell text-green-700 font-semibold text-base">
          ${item.meaning}
        </td>
        <td class="table-cell text-indigo-500 font-mono">
          ${item.romaji}
        </td>
        <td class="table-cell text-gray-600 font-medium">
          ${
            item.kanji ||
            '<span class="text-xs text-gray-400"> (-) </span>'
          }
        </td>
      `;
    $tableBody.appendChild(row);
  });

  // စုစုပေါင်း အရေအတွက်ကို ပြသခြင်း
  if ($itemCount) $itemCount.textContent = data.length;
}

/**
 * Chapter Select Dropdown ကို Update လုပ်ခြင်း
 */
function updateChapterSelect() {
  if (!$select) return;
  $select.innerHTML = ""; // အဟောင်းများ ရှင်းလင်း
  chapterKeys.forEach((key, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = `Chapter: ${key}`;
    if (index === currentChapterIndex) {
      option.selected = true;
    }
    $select.appendChild(option);
  });
}

/**
 * Navigation Button များကို Enable/Disable လုပ်ခြင်း
 */
function updateNavigationButtons() {
  if ($prevButton) $prevButton.disabled = currentChapterIndex === 0;
  if ($nextButton) $nextButton.disabled = currentChapterIndex === chapterKeys.length - 1;

  // လက်ရှိ Chapter ကို UI တွင် ပြသခြင်း
  if ($chapterDisplay) {
    $chapterDisplay.textContent = `(${
      chapterKeys[currentChapterIndex] || "N/A"
    })`;
  }
}

/**
 * Chapter ကို ပြောင်းလဲခြင်း (Dropdown သို့မဟုတ် Button မှ)
 * @param {string} source - 'prev', 'next', or 'select'
 */
window.changeChapter = function (source) {
  let newIndex = currentChapterIndex;

  if (source === "prev" && newIndex > 0) {
    newIndex--;
  } else if (source === "next" && newIndex < chapterKeys.length - 1) {
    newIndex++;
  } else if (source === "select") {
    if (!$select) return;
    newIndex = parseInt($select.value, 10);
  }

  if (
    newIndex !== currentChapterIndex &&
    newIndex >= 0 &&
    newIndex < chapterKeys.length
  ) {
    currentChapterIndex = newIndex;
    const newChapterKey = chapterKeys[currentChapterIndex];
    renderVocabularyTable(newChapterKey);
    updateChapterSelect();
    updateNavigationButtons();
  }
};

/**
 * App စတင်ခြင်း
 */
function initializeApp() {
  // 1. Data ကို အုပ်စုဖွဲ့သည်
  loadVocabularyData();
  
  // 2. Data ရှိမှသာ စတင်ပြသမည်
  if (chapterKeys.length > 0) {
    renderVocabularyTable(chapterKeys[currentChapterIndex]);
    updateChapterSelect();
    updateNavigationButtons();
  }
}

/**
 * Error Message ပြသခြင်း (If data loading fails)
 */
function displayError(message) {
  const $appContainer = document.getElementById("meaningApp");
  if (!$appContainer) return;
  
  $appContainer.innerHTML = `
    <h1 class="text-3xl font-extrabold text-center text-indigo-700 mb-6">ဂျပန်ဝေါဟာရ လေ့လာရေး</h1>
    <div class="text-red-600 text-center py-8 bg-red-100 rounded-xl border border-red-300">
      <p class="font-bold mb-2">Error ဖြစ်ပွားသည်!</p>
      <p>${message}</p>
    </div>
  `;
}

// DOM Load ပြီးပါက data fetch စတင်ရန်
document.addEventListener("DOMContentLoaded", getStartMeaningClick);
