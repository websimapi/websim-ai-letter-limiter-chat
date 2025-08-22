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
                conversationHistory.push({ role: 'assistant', content: JSON.stringify(aiResponse) });
            } else {
                 displayErrorMessage('Sorry, I received an invalid response. Please try again.');
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

    // New 3-step process to get the AI response
    async function getAIResponse(allowedLetters) {
        // Step 1: Get a standard, conversational response without constraints.
        const idealResponseText = await getIdealResponse();
        if (!idealResponseText) throw new Error("Step 1 failed: Could not generate an ideal response.");

        // Step 2 & 3: Take the ideal response and transform it based on the letter constraints.
        const finalResponseJson = await getTransformedResponse(idealResponseText, allowedLetters);
        
        return finalResponseJson;
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

    async function getTransformedResponse(idealResponseText, allowedLetters) {
        console.log("Step 2 & 3: Transforming response...");
        const userContent = `The ideal response to the user is: "${idealResponseText}"

The only letters you can use are: "${allowedLetters}"

Now, convert the ideal response into the required JSON format, using only the allowed letters and applying CSS transformations where necessary to create letters you don't have.`;

        const completion = await websim.chat.completions.create({
            messages: [
                { role: 'system', content: transformationSystemPrompt },
                { role: 'user', content: userContent }
            ],
            json: true,
        });

        try {
            const responseJson = JSON.parse(completion.content);
            console.log("Transformation successful:", responseJson);
            return responseJson;
        } catch (e) {
            console.error("Failed to parse AI response JSON:", e);
            console.error("Raw response:", completion.content);
            return null;
        }
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