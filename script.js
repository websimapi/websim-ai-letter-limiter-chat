document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const allowedLettersInput = document.getElementById('allowed-letters');
    const chatMessages = document.getElementById('chat-messages');
    const chatWindow = document.getElementById('chat-window');

    let conversationHistory = [];

    const systemPrompt = `You are a creative AI assistant. You must respond to the user, but you have a unique constraint: you can only use the letters provided in the user's prompt.

To form words, you can be creative. If you don't have a letter you need, you can use an allowed letter and specify a CSS transform to make it look like the letter you want.
Examples:
- To make a 'p', use a 'd' and apply 'rotate(180deg)'.
- To make an 'm', use a 'w' and apply 'rotate(180deg)'.
- An 'n' can become a 'u' with 'rotate(180deg)'.
- An 'i' can become an '!' with 'scaleY(-1)'.

Your response MUST be a single, valid JSON object and nothing else. Do not include any text, markdown, or explanations outside of the JSON structure.

The JSON object must strictly follow this structure:
{
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
            renderAIResponse(aiResponse);
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
        const userContent = `Allowed letters: "${allowedLetters}"\n\nUser message: "${userMessage}"`;
        
        conversationHistory.push({ role: 'user', content: userContent });
        conversationHistory = conversationHistory.slice(-6); // Keep history short

        const completion = await websim.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                ...conversationHistory,
            ],
            json: true,
        });

        const responseJson = JSON.parse(completion.content);
        conversationHistory.push({ role: 'assistant', content: completion.content });
        return responseJson;
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
            [{ letter: "h", transformation: "none", reason: "Available"}, { letter: "e", transformation: "none", reason: "Available"}, { letter: "l", transformation: "none", reason: "Available"}, { letter: "l", transformation: "none", reason: "Available"}, { letter: "o", transformation: "none", reason: "Available"}]
        ]
    };
    renderAIResponse(initialMessage);
});