document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const allowedLettersInput = document.getElementById('allowed-letters');
    const chatMessages = document.getElementById('chat-messages');
    const chatWindow = document.getElementById('chat-window');

    let conversationHistory = [];

    // This is the prompt for the FINAL step, where the AI converts a plain text response into the special JSON format.
    const transformationSystemPrompt = `You are a creative text transformation AI. Your task is to take a given "ideal response" and rewrite it using only a specific set of "allowed letters".

To form words, you must be creative. If you don't have a letter you need, you can use an allowed letter and specify a CSS transform to make it look like the letter you want.
Examples:
- To make a 'p', use a 'd' and apply 'rotate(180deg)'.
- To make an 'm', use a 'w' and apply 'rotate(180deg)'.
- An 'n' can become a 'u' with 'rotate(180deg)'.
- A 'c' can become a 'u' if needed, with 'rotate(90deg)'.
- An 'l' can become a '!' with some creativity.

Your response MUST be a single, valid JSON object and nothing else. Do not include any text, markdown, or explanations outside of the JSON structure.

The JSON object must strictly follow this structure:
{
  "thinking": "First, I'll analyze the ideal response. Then, I will figure out how to construct each word using only the allowed letters, applying transformations where necessary. I will document my reasoning for each letter.",
  "words": [
    // This is an array of words.
    [ 
      // This is an array of letters, representing a single word.
      { "letter": "h", "transformation": "none", "reason": "Directly available." },
      { "letter": "o", "transformation": "none", "reason": "Directly available." },
      { "letter": "d", "transformation": "rotate(180deg)", "reason": "Used 'd' rotated to make 'p'." }
    ]
  ]
}

Each letter object MUST have these three keys:
- "letter": (string) The character from the allowed set that you are using.
- "transformation": (string) A valid CSS transform string (e.g., "rotate(90deg)", "scaleX(-1)", "none"). Use "none" if no transformation is needed.
- "reason": (string) A brief explanation of why you chose this letter and transformation.

The "thinking" field is for your internal monologue to plan your response. The user will not see it. Your actual reply goes in the "words" array.
`;

    // New AI prompt to fix invalid JSON
    const jsonFixerSystemPrompt = `You are a JSON correction AI. A previous AI call failed to produce valid JSON according to a specific schema. Your task is to fix the provided invalid text and make it a valid JSON object that conforms to the required structure. The user will provide the original prompt, the invalid text, and the error. Respond ONLY with the corrected, valid JSON object and nothing else.`;

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userMessage = messageInput.value.trim();
        const allowedLetters = allowedLettersInput.value.trim();

        if (!userMessage || !allowedLetters) return;

        displayUserMessage(userMessage);
        messageInput.value = '';
        
        conversationHistory.push({ role: 'user', content: userMessage });
        conversationHistory = conversationHistory.slice(-6); // Keep history short

        const loadingIndicator = displayLoadingIndicator();

        try {
            const aiResponse = await getAIResponse(allowedLetters);
            loadingIndicator.remove();
            if (aiResponse) {
                renderAIResponse(aiResponse);
                 // Add the final, successful response to history for context
                conversationHistory.push({ role: 'assistant', content: `Responded with: ${JSON.stringify(aiResponse.words.map(w => w.map(l => l.letter).join('')).join(' '))}` });
            } else {
                 displayErrorMessage('Sorry, I couldn\'t generate a valid response. Please try again.');
            }
        } catch (error) {
            console.error('Error getting AI response:', error);
            loadingIndicator.remove();
            displayErrorMessage('Sorry, I had trouble thinking of a response. Please try again.');
        }
    });

    function displayUserMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'user');
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        scrollToBottom();
    }
    
    function displayErrorMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'ai');
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        scrollToBottom();
    }

    function displayLoadingIndicator() {
        const loadingElement = document.createElement('div');
        loadingElement.classList.add('message', 'loading');
        loadingElement.innerHTML = `<div class="dot-flashing"></div>`;
        chatMessages.appendChild(loadingElement);
        scrollToBottom();
        return loadingElement;
    }

    // New 3-step process with retry logic
    async function getAIResponse(allowedLetters) {
        // Step 1: Get a standard, conversational response without constraints.
        const idealResponseText = await getIdealResponse();
        if (!idealResponseText) throw new Error("Step 1 failed: Could not generate an ideal response.");

        // Step 2 & 3 with retry logic
        let retries = 3;
        let lastError = null;
        let lastInvalidResponse = null;

        while (retries > 0) {
            try {
                console.log(`Transformation attempt, retries left: ${retries}`);
                const responseJson = await getTransformedResponse(idealResponseText, allowedLetters, lastInvalidResponse, lastError);
                return responseJson; // If successful, exit the loop and return.
            } catch (error) {
                console.error(`Attempt failed: ${error.message}`);
                lastError = error.message;
                lastInvalidResponse = error.rawResponse || lastInvalidResponse; // Store the raw invalid response for the next attempt
                retries--;
                if (retries === 0) {
                    // All retries failed, throw the last error to be caught by the submit handler.
                    console.error("All retries failed.");
                    throw new Error("Failed to get a valid response from the AI after multiple attempts.");
                }
            }
        }
    }

    async function getIdealResponse() {
        console.log("Step 1: Generating ideal response...");
        const idealResponseSystemPrompt = `You are a friendly and helpful conversational assistant. The user will provide their message. Respond to the last user message in a natural and engaging way. Do not use any special formatting. Just provide a plain text response. Keep it concise, about 1-3 sentences.`;

        const completion = await websim.chat.completions.create({
            messages: [
                { role: 'system', content: idealResponseSystemPrompt },
                ...conversationHistory,
            ],
        });
        console.log("Ideal response received:", completion.content);
        return completion.content;
    }

    async function getTransformedResponse(idealResponseText, allowedLetters, invalidResponseToFix = null, previousError = null) {
        let systemPrompt = transformationSystemPrompt;
        let userContent;

        if (invalidResponseToFix) {
            console.log("Attempting to fix previous invalid response...");
            systemPrompt = jsonFixerSystemPrompt;
            userContent = `The original prompt was to convert "${idealResponseText}" using only the letters "${allowedLetters}".
            The previous attempt failed with this error: "${previousError}".
            Here is the invalid response that needs fixing:
            \`\`\`
            ${invalidResponseToFix}
            \`\`\`
            Please correct it to be a valid JSON object matching the required schema.`;
        } else {
             console.log("Step 2 & 3: Transforming response...");
             userContent = `The ideal response to the user is: "${idealResponseText}"

            The only letters you can use are: "${allowedLetters}"

            Now, convert the ideal response into the required JSON format, using only the allowed letters and applying CSS transformations where necessary to create letters you don't have.`;
        }

        const completion = await websim.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            json: true,
        });

        let responseJson;
        try {
            responseJson = JSON.parse(completion.content);
        } catch (e) {
            console.error("Failed to parse AI response JSON:", e);
            console.error("Raw response:", completion.content);
            const error = new Error("Response was not valid JSON.");
            error.rawResponse = completion.content;
            throw error;
        }

        // Validate the structure of the parsed JSON
        if (typeof responseJson !== 'object' || !Array.isArray(responseJson.words)) {
             console.error("Parsed JSON has invalid structure:", responseJson);
             const error = new Error("JSON structure is invalid (missing 'words' array).");
             error.rawResponse = completion.content;
             throw error;
        }
        
        console.log("Transformation successful:", responseJson);
        return responseJson;
    }

    function renderAIResponse(response) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'ai');

        if (!response || !response.words || !Array.isArray(response.words)) {
            console.error("Invalid AI response format:", response);
            messageElement.textContent = "I'm sorry, my response was formatted incorrectly.";
            chatMessages.appendChild(messageElement);
            scrollToBottom();
            return;
        }

        response.words.forEach(wordData => {
            if (!Array.isArray(wordData)) return; // Skip if a "word" isn't an array
            const wordElement = document.createElement('span');
            wordElement.classList.add('ai-word');
            wordData.forEach(letterData => {
                 if (typeof letterData !== 'object' || letterData === null || !letterData.letter) return; // Skip invalid letter objects
                const letterElement = document.createElement('span');
                letterElement.classList.add('ai-letter');
                letterElement.textContent = letterData.letter;
                letterElement.style.transform = letterData.transformation || 'none';
                letterElement.title = letterData.reason || 'No specific reason';
                wordElement.appendChild(letterElement);
            });
            messageElement.appendChild(wordElement);
        });

        chatMessages.appendChild(messageElement);
        scrollToBottom();
    }

    function scrollToBottom() {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    // Initial message from AI
    function displayInitialMessage() {
        const initialMessage = {
            words: [
                [{ letter: "h", transformation: "none", reason: "Available"}, { letter: "e", transformation: "none", reason: "Available"}, { letter: "l", transformation: "none", reason: "Available"}, { letter: "l", transformation: "none", reason: "Available"}, { letter: "o", transformation: "none", reason: "Available"}],
                [{ letter: "a", transformation: "none", reason: "Available"}, { letter: "n", transformation: "none", reason: "Available"}, { letter: "d", transformation: "none", reason: "Available"}],
                [{ letter: "w", transformation: "none", reason: "Available"}, { letter: "e", transformation: "none", reason: "Available"}, { letter: "l", transformation: "none", reason: "Available"}, { letter: "c", transformation: "none", reason: "Available"}, { letter: "o", transformation: "none", reason: "Available"}, { letter: "w", transformation: "rotate(180deg)", reason: "Used 'w' for 'm'"}, { letter: "e", transformation: "none", reason: "Available"}]
            ]
        };
        renderAIResponse(initialMessage);
    }
    displayInitialMessage();
});