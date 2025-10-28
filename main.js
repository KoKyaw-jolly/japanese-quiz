let initialData = [];

/**
 * Retrieves the appropriate value from a vocabulary item based on the key,
 * handling the combined 'kana' type by prioritizing hirakana.
 * @param {Object} item - The vocabulary item object.
 * @param {string} key - The desired type ('kana', 'romaji', 'meaning', etc.)
 * @returns {string} - The resolved value or 'N/A' if not found.
 */
function getValueForKey(item, key) {
  if (key === "kana") {
    // Prioritize hirakana, but use katakana if hirakana is missing.
    // This solves the original issue by ensuring one kana is always used if available.
    return item.hirakana || item.katakana || "N/A";
  }
  return item[key] || "N/A";
}

function getStartQuizClick() {
  fetch("json/data.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Could not find data.json");
      }
      return response.json();
    })
    .then((data) => {
      // FIX: Assign the data and THEN call renderConfig() to start the app.
      initialData = data;
      console.log("AFTER fetch (inside .then):", initialData);
      renderConfig();
    })
    .catch((error) => {
      console.error("Error loading data:", error);
      // Display a friendly error message if data fails to load
      const $app = document.getElementById("app");
      if ($app) {
        $app.innerHTML =
          '<div class="text-red-600 text-center py-8">Failed to load quiz data. Please ensure "json/data.json" exists and is correctly formatted.</div>';
      }
    });
}
// --- 2. GLOBAL STATE ---
const $app = document.getElementById("app");
let quizQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let config = {};
let isAnswerLocked = false; // Flag to prevent multiple clicks

// --- 3. UTILITY FUNCTIONS ---

// Simple Fisher-Yates shuffle
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Selects unique items from a pool to use as distractors.
 * @param {Array<Object>} pool - The full vocabulary list.
 * @param {string} correctValue - The correct answer value (of the choiceType).
 * @param {string} choiceKey - The key to extract the choice value ('kana', 'meaning', etc.).
 * @param {number} count - The number of distractors needed.
 * @returns {Array<string>} - Array of distractor values.
 */
function getDistractors(pool, correctValue, choiceKey, count = 3) {
  const distractors = [];
  const kanjiRequiredByQuestion =
    config.questionType === "kanji" || config.choiceType === "kanji";
  // FIX: Use getValueForKey for filtering to consistently handle 'kana' type
  const incorrectItems = pool.filter((item) => {
    // getValueForKey(item, choiceKey) !== correctValue
    const isIncorrect = getValueForKey(item, choiceKey) !== correctValue;

    if (!isIncorrect) return false;

    if (kanjiRequiredByQuestion) {
      return item.kanji !== "";
    }

    return true;
  });

  // Ensure we have enough items to choose from
  if (incorrectItems.length < count) {
    // If not enough unique items, return what we have (this is rare for real-world apps)
    shuffleArray(incorrectItems);
    // FIX: Use getValueForKey when mapping the final selection
    return incorrectItems
      .slice(0, count)
      .map((item) => getValueForKey(item, choiceKey));
  }

  // Pick 'count' unique random indices
  const indices = new Set();
  while (indices.size < count) {
    const randomIndex = Math.floor(Math.random() * incorrectItems.length);
    indices.add(randomIndex);
  }

  // Map indices back to values
  // FIX: Use getValueForKey when mapping the final selection
  const selectedDistractors = Array.from(indices).map((i) =>
    getValueForKey(incorrectItems[i], choiceKey)
  );
  return selectedDistractors;
}

// --- 4. RENDER FUNCTIONS ---

function renderConfig() {
  // Ensure we have data before rendering configuration
  if (initialData.length === 0) {
    $app.innerHTML =
      '<div class="text-center py-8 text-xl text-gray-500">Loading data...</div>';
    return; // If called before fetch completes (should be prevented by the fix above)
  }

  // FIX: Define the new simplified type lists
  const questionTypes = ["kana", "romaji", "kanji", "meaning"];
  const choiceTypes = ["meaning", "romaji", "kana", "kanji"];

  $app.innerHTML = `
                <h2 class="text-2xl font-bold text-center text-gray-800 mb-6">Quiz Configuration</h2>

                <!-- Question Count -->
                <div class="mb-6 px-4 py-3 border border-indigo-200 rounded-lg bg-indigo-50">
                    <h3 class="font-semibold text-md text-indigo-700 mb-2">1. Select Question Count</h3>
                    <div class="flex flex-wrap gap-3" id="count-options">
                        ${[10, 20, 30, initialData.length]
                          .map(
                            (count) => `
                            <label class="flex items-center space-x-2 text-sm">
                                <input type="radio" name="question-count" value="${count}" class="form-radio text-indigo-600 h-4 w-4" ${
                              count === 10 ? "checked" : ""
                            }>
                                <span class="text-gray-700">${
                                  count === initialData.length ? "All" : count
                                }</span>
                            </label>
                        `
                          )
                          .join("")}
                    </div>
                </div>

                <!-- Chapter Selection -->
                <div class="mb-6  px-4 py-3 border border-indigo-200 rounded-lg bg-indigo-50">
                    <h3 class="font-semibold text-md text-indigo-700 mb-2">2. Select Chapters (Required)</h3>
                    <div class="flex flex-wrap gap-3" id="chapter-options">
                        ${[...new Set(initialData.map((item) => item.chapter))]
                          .sort()
                          .map(
                            (chapter) => `
                            <label class="flex items-center space-x-2 text-sm">
                                <input type="checkbox" name="chapter" value="${chapter}" class="form-checkbox text-indigo-600 rounded h-4 w-4" checked>
                                <span class="text-gray-700">${chapter}</span>
                            </label>
                        `
                          )
                          .join("")}
                    </div>
                </div>

                <!-- Question/Choice Types -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div class=" px-4 py-3 border border-indigo-200 rounded-lg bg-indigo-50">
                        <h3 class="font-semibold text-md text-indigo-700 mb-2">3. Question (Prompt)</h3>
                        <div class="space-y-2" id="question-type-options">
                            ${questionTypes
                              .map(
                                (type) => `
                                <label class="block text-sm">
                                    <input type="radio" name="question-type" value="${type}" class="form-radio text-indigo-600 h-4 w-4" ${
                                  type === "kana" ? "checked" : ""
                                }>
                                    <span class="ml-2 capitalize">${type.replace(
                                      "kana",
                                      "Hiragana / Katakana"
                                    )}</span>
                                </label>
                            `
                              )
                              .join("")}
                        </div>
                    </div>
                    <div class="p-4 border border-indigo-200 rounded-lg bg-indigo-50">
                        <h3 class="font-semibold text-md text-indigo-700 mb-2">4. Answer (Choice)</h3>
                        <div class="space-y-2" id="choice-type-options">
                            ${choiceTypes
                              .map(
                                (type) => `
                                <label class="block text-sm">
                                    <input type="radio" name="choice-type" value="${type}" class="form-radio text-indigo-600 h-4 w-4" ${
                                  type === "meaning" ? "checked" : ""
                                }>
                                    <span class="ml-2 capitalize">${type.replace(
                                      "kana",
                                      "Hiragana / Katakana"
                                    )}</span>
                                </label>
                            `
                              )
                              .join("")}
                        </div>
                    </div>
                </div>

                <button id="start-quiz-btn" class="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition duration-150">
                    Start Quiz
                </button>
            `;

  document.getElementById("start-quiz-btn").onclick = setupQuiz;
}

function setupQuiz() {
  // 1. Get configuration values
  const countEl = document.querySelector(
    'input[name="question-count"]:checked'
  );
  const chapterEls = document.querySelectorAll('input[name="chapter"]:checked');
  const questionTypeEl = document.querySelector(
    'input[name="question-type"]:checked'
  );
  const choiceTypeEl = document.querySelector(
    'input[name="choice-type"]:checked'
  );

  if (!countEl || !chapterEls.length || !questionTypeEl || !choiceTypeEl) {
    // Use a custom message box instead of alert()
    $app.insertAdjacentHTML(
      "beforeend",
      `
            <div id="error-message" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div class="bg-white p-6 rounded-lg shadow-xl">
                    <p class="text-red-600 font-semibold mb-4">Please ensure at least one chapter is selected and all options are chosen.</p>
                    <button onclick="document.getElementById('error-message').remove()" class="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600">Close</button>
                </div>
            </div>
        `
    );
    return;
  }

  config.questionCount = parseInt(countEl.value, 10);
  config.chapters = Array.from(chapterEls).map((el) => el.value);
  config.questionType = questionTypeEl.value;
  config.choiceType = choiceTypeEl.value;

  // 2. Filter data by selected chapters
  let filteredData = initialData.filter((item) => {
    if (config.questionType == "kanji" || config.choiceType == "kanji") {
      return config.chapters.includes(item.chapter) && item.kanji !== "";
    } else {
      return config.chapters.includes(item.chapter);
    }
  });

  // 3. Select random questions up to the requested count
  shuffleArray(filteredData);
  quizQuestions = filteredData.slice(
    0,
    Math.min(config.questionCount, filteredData.length)
  );

  if (quizQuestions.length === 0) {
    $app.insertAdjacentHTML(
      "beforeend",
      `
            <div id="error-message" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div class="bg-white p-6 rounded-lg shadow-xl">
                    <p class="text-red-600 font-semibold mb-4">No vocabulary found for the selected chapters. Please choose other chapters.</p>
                    <button onclick="document.getElementById('error-message').remove()" class="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600">Close</button>
                </div>
            </div>
        `
    );
    return;
  }

  // 4. Initialize quiz state
  currentQuestionIndex = 0;
  score = 0;
  isAnswerLocked = false;

  // 5. Start the quiz
  renderQuizQuestion();
}

function renderQuizQuestion() {
  if (currentQuestionIndex >= quizQuestions.length) {
    renderResults();
    return;
  }

  const currentItem = quizQuestions[currentQuestionIndex];

  // FIX: Use getValueForKey to get the question text, handling 'kana' type
  const questionText = getValueForKey(currentItem, config.questionType);

  // FIX: Use getValueForKey to get the correct answer value, handling 'kana' type
  const correctAnswer = getValueForKey(currentItem, config.choiceType);

  // 1. Get the distractors
  const distractors = getDistractors(
    initialData,
    correctAnswer,
    config.choiceType,
    3 // We need 3 distractors
  );

  // 2. Combine and shuffle choices
  let choices = [...distractors, correctAnswer];
  shuffleArray(choices);

  // 3. Update the UI
  $app.innerHTML = `
                <div class="text-center mb-6">
                    <p class="text-xl font-medium text-gray-500">
                        Question ${currentQuestionIndex + 1} / ${
    quizQuestions.length
  }
                    </p>
                    <p class="text-sm font-medium text-gray-500 mb-4">
                        Question Type: ${config.questionType} → Answer Type: ${
    config.choiceType
  }
                    </p>
                    <div class="question-text text-indigo-800 text-3xl font-extrabold p-4 border-b-2 border-indigo-100 mb-8">${questionText}</div>
                </div>

                <div id="choices-container" class="space-y-4">
                    ${choices
                      .map(
                        (choice, index) => `
                        <button
                            data-choice-value="${choice}"
                            data-is-correct="${choice === correctAnswer}"
                            class="btn-choice w-full py-3 px-4 text-lg bg-gray-100 text-gray-800 border-2 border-gray-300 rounded-xl text-left hover:bg-indigo-50 transition duration-150"
                        >
                            <span class="font-bold mr-3 text-indigo-500">${String.fromCharCode(
                              65 + index
                            )}.</span> ${choice}
                        </button>
                    `
                      )
                      .join("")}
                </div>

                <!-- Increased space for feedback, which now includes details -->
                <button id="next-btn" class="w-full py-3 mt-6 bg-gray-400 text-white font-bold rounded-xl cursor-not-allowed" disabled>
                    Next Question
                </button>
                <div id="feedback" class="mt-6 text-center"></div> 
            `;

  // 4. Attach event listeners to choice buttons
  document.querySelectorAll("#choices-container button").forEach((button) => {
    // PASS THE FULL currentItem TO handleAnswer
    button.onclick = (e) =>
      handleAnswer(e.currentTarget, correctAnswer, currentItem);
  });
}

function handleAnswer(selectedButton, correctAnswer, currentItem) {
  if (isAnswerLocked) return;

  isAnswerLocked = true;
  const selectedValue = selectedButton.getAttribute("data-choice-value");
  const isCorrect = selectedValue === correctAnswer;

  // Disable all buttons and show feedback
  const buttons = document.querySelectorAll("#choices-container button");
  buttons.forEach((btn) => {
    btn.classList.add("disabled", "cursor-not-allowed");
    btn.disabled = true;

    const choiceValue = btn.getAttribute("data-choice-value");

    if (choiceValue === correctAnswer) {
      // Always highlight the correct answer
      btn.classList.remove(
        "bg-gray-100",
        "hover:bg-indigo-50",
        "border-gray-300"
      );
      btn.classList.add("bg-green-100", "border-green-500");
    } else if (btn === selectedButton && !isCorrect) {
      // Highlight the incorrect selection
      btn.classList.remove(
        "bg-gray-100",
        "hover:bg-indigo-50",
        "border-gray-300"
      );
      btn.classList.add("bg-red-100", "border-red-500");
    }
    // Remove hover styles from all choices after selection
    btn.classList.remove("hover:bg-indigo-50");
  });

  if (isCorrect) {
    score++;
  }

  // --- NEW: Generate detailed feedback HTML ---
  const scoreMessage = isCorrect
    ? '<span class="text-green-600 font-bold">Correct! (+1 Point)</span>'
    : '<span class="text-red-600 font-bold">Incorrect. The correct answer is highlighted in green.</span>';

  const detailHtml = `
    <div class="mt-4 p-4 bg-white border border-indigo-300 rounded-xl text-left shadow-lg">
        <h4 class="font-extrabold text-lg mb-3 text-indigo-700">Vocabulary Details:</h4>
        <ul class="list-none p-0 m-0 space-y-2">
            <li class="flex justify-between items-center border-b border-gray-100 pb-1">
                <span class="font-semibold text-gray-600 w-1/3">Hiragana:</span>
                <span class="text-right w-2/3 text-indigo-900 text-2xl">${currentItem.hirakana}</span>
            </li>
            <li class="flex justify-between items-center border-b border-gray-100 pb-1">
                <span class="font-semibold text-gray-600 w-1/3">Katakana:</span>
                <span class="text-right w-2/3 text-indigo-900 text-2xl">${currentItem.katakana}</span>
            </li>
            <li class="flex justify-between items-center border-b border-gray-100 pb-1">
                <span class="font-semibold text-gray-600 w-1/3">Romaji:</span>
                <span class="text-right w-2/3 text-indigo-900">${currentItem.romaji}</span>
            </li>
            <li class="flex justify-between items-center border-b border-gray-100 pb-1">
                <span class="font-semibold text-gray-600 w-1/3">Kanji:</span>
                <span class="text-right w-2/3 text-indigo-900 font-extrabold text-3xl">${currentItem.kanji}</span>
            </li>
            <li class="flex justify-between items-center pt-1">
                <span class="font-semibold text-gray-600 w-1/3">Meaning:</span>
                <span class="text-right w-2/3 text-indigo-900">${currentItem.meaning}</span>
            </li>
            <li class="flex justify-between pt-1 text-xs text-gray-400">
                <span class="font-semibold w-1/3">Source Chapter:</span>
                <span class="text-right w-2/3">${currentItem.chapter}</span>
            </li>
        </ul>
    </div>
  `;

  const $feedback = document.getElementById("feedback");
  $feedback.innerHTML = `<div class="mb-3">${scoreMessage}</div>${detailHtml}`;
  // --- END NEW ---

  // Enable next button
  const $nextBtn = document.getElementById("next-btn");
  $nextBtn.disabled = false;
  $nextBtn.classList.remove("bg-gray-400", "cursor-not-allowed");
  $nextBtn.classList.add("bg-indigo-600", "hover:bg-indigo-700");

  // Move to next question after a brief delay
  $nextBtn.onclick = () => {
    currentQuestionIndex++;
    isAnswerLocked = false;
    renderQuizQuestion();
  };
}

function renderResults() {
  const totalQuestions = quizQuestions.length;
  const percentage = (score / totalQuestions) * 100;

  $app.innerHTML = `
                <div class="text-center py-10">
                    <h2 class="text-4xl font-extrabold text-indigo-700 mb-4">Quiz Finished!</h2>
                    <p class="text-5xl font-bold mb-6">${score} / ${totalQuestions}</p>
                    <p class="text-2xl font-semibold text-gray-700 mb-10">
                        Score: <span class="text-green-600">${percentage.toFixed(
                          1
                        )}%</span>
                    </p>

                    <!-- Using window.location.reload() simplifies returning to the initial config state cleanly -->
                    <button onclick="getStartQuizClick();" class="w-full mb-3 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition duration-150">
                        <span class="mr-2">&#x21BB;</span> Restart Quiz / Go to Home
                    </button>
                </div>
            `;
}

// --- 5. INITIALIZATION ---
// The fetch block now handles the initial call to renderConfig.

// getStartQuizClick(); // Call the initial function to start data fetching

function getStartMeaningClick() {
  window.location.href = "html/meaning.html";
}