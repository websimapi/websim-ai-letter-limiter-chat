document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const allowedLettersInput = document.getElementById('allowed-letters');
    const chatMessages = document.getElementById('chat-messages');
    const chatWindow = document.getElementById('chat-window');

    let conversationHistory = [];

    const systemPrompt = `You are a creative and conversational AI assistant. Your primary goal is to chat with the user and respond to their messages in a meaningful way.

However, you have a unique constraint: you can only use the letters provided in the user's prompt to form your response.

To form words, you must be creative. If you don't have a letter you need, you can use an allowed letter and specify a CSS transform to make it look like the letter you want.
Examples:
- To make a 'p', use a 'd' and apply 'rotate(180deg)'.
- To make an 'm', use a 'w' and apply 'rotate(180deg)'.
- An 'n' can become a 'u' with 'rotate(180deg)'.
- An 'i' can become an '!' with 'scaleY(-1)'.
- A 'c' can become an 'e' with 'transform: rotate(180deg) scale(-1, 1)'.

Your response MUST be a single, valid JSON object and nothing else. Do not include any text, markdown, or explanations outside of the JSON structure.

The JSON object must strictly follow this structure:
{
  "thinking": "First, I need to understand what the user said. Then, I'll formulate a response. Finally, I will construct my response using only the allowed letters, getting creative with transformations if needed.",
  "words": [
    // This is an array of words.
    [ 
      // This is an array of letters, representing a single word.
      { "letter": "h", "transformation": "none", "reason": "Directly available." },
      { "letter": "e", "transformation": "none", "reason": "Directly available." },
      { "letter": "l", "transformation": "none", "reason": "Directly available." },
      { "letter": "l", "transformation": "none", "reason": "Directly available." },
      { "letter": "o", "transformation": "none", "reason": "Directly available." }
    ]
  ]
}

Each letter object MUST have these three keys:
- "letter": (string) The character from the allowed set that you are using.
- "transformation": (string) A valid CSS transform string (e.g., "rotate(90deg)", "scaleX(-1)", "none"). Use "none" if no transformation is needed.
- "reason": (string) A brief explanation of why you chose this letter and transformation.

The "thinking" field is for your internal monologue to plan your response. Do not put your conversational reply there. The user will not see it. Your actual reply goes in the "words" array. Be a good conversationalist! Listen to the user and reply appropriately.
`;

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userMessage = messageInput.value.trim();
        const allowedLetters = allowedLettersInput.value.trim();

        if (!userMessage || !allowedLetters) return;

        displayUserMessage(userMessage);
        messageInput.value = '';

        const loadingIndicator = displayLoadingIndicator();

        try {
            const aiResponse = await getAIResponse(userMessage, allowedLetters);
            loadingIndicator.remove();
            if (aiResponse) {
                renderAIResponse(aiResponse);
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

    async function getAIResponse(userMessage, allowedLetters) {
        const userContent = `These are the only letters I can use: "${allowedLetters}"\n\nHere is the user's message I need to respond to: "${userMessage}"`;
        
        conversationHistory.push({ role: 'user', content: userContent });
        conversationHistory = conversationHistory.slice(-6); // Keep history short

        const completion = await websim.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                ...conversationHistory,
            ],
            json: true,
        });

        try {
            const responseJson = JSON.parse(completion.content);
            conversationHistory.push({ role: 'assistant', content: completion.content });
            return responseJson;
        } catch (e) {
            console.error("Failed to parse AI response JSON:", e);
            console.error("Raw response:", completion.content);
            // Push the raw (invalid) response to history so the AI can see its mistake
            conversationHistory.push({ role: 'assistant', content: completion.content });
            return null;
        }
    }

    function renderAIResponse(response) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'ai');

        if (!response || !response.words) {
            console.error("Invalid AI response format:", response);
            messageElement.textContent = "I'm sorry, my response was formatted incorrectly.";
            chatMessages.appendChild(messageElement);
            scrollToBottom();
            return;
        }

        response.words.forEach(wordData => {
            const wordElement = document.createElement('span');
            wordElement.classList.add('ai-word');
            wordData.forEach(letterData => {
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
    const initialMessage = {
        words: [
            [{ letter: "h", transformation: "none", reason: "Available"}, { letter: "e", transformation: "none", reason: "Available"}, { letter: "l", transformation: "none", reason: "Available"}, { letter: "l", transformation: "none", reason: "Available"}, { letter: "o", transformation: "none", reason: "Available"}],
            [{ letter: "w", transformation: "none", reason: "Available"}, { letter: "o", transformation: "none", reason: "Available"}, { letter: "l", transformation: "rotate(180deg)", reason: "Using 'l' for 'r' is a stretch, but possible"}, { letter: "d", transformation: "none", reason: "Available"}]
        ]
    };
    renderAIResponse(initialMessage);
});