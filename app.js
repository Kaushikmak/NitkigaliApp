document.addEventListener('DOMContentLoaded', () => {
    const RAILWAY_HOST = 'nitkigali-production.up.railway.app'; 
  
    // --- Screen and Button Elements ---
    const findChatBtn = document.getElementById('find-chat-btn');
    const skipBtn = document.getElementById('skip-btn'); 
    const statusText = document.getElementById('status-text');
    
    const waitingScreen = document.getElementById('waiting-screen');
    const chatScreen = document.getElementById('chat-screen');
    
    const quitBtn = document.getElementById('quit-btn'); 
    const chatLog = document.getElementById('chat-log');
    const messageInput = document.getElementById('chat-message-input');
    const messageSubmit = document.getElementById('chat-message-submit');

    let chatSocket = null;
    let matchmakingSocket = null;
    let lastMessageSent = ""; // Used to filter out our own echoes
    let isSkipping = false;   // Used to manage skip button logic

    // --- Matchmaking Logic ---

    findChatBtn.addEventListener('click', () => {
        statusText.textContent = 'Connecting to matchmaking...';
        findChatBtn.disabled = true;
        findChatBtn.classList.add('hidden'); // Hide Find button
        
        isSkipping = false; // Reset skip flag
        
        const matchmakingUrl = `wss://${RAILWAY_HOST}/ws/find_chat/`;
        matchmakingSocket = new WebSocket(matchmakingUrl);

        matchmakingSocket.onopen = () => {
            statusText.textContent = 'Waiting for a partner...';
            skipBtn.classList.remove('hidden'); // Show Skip button
        };

        matchmakingSocket.onmessage = (e) => {
            const data = JSON.parse(e.data);

            if (data.status === 'waiting') {
                statusText.textContent = 'Waiting for a partner...';
            }

            if (data.type === 'redirect') {
                const roomName = data.room_name;
                statusText.textContent = `Partner found! Joining room: ${roomName}`;
                
                skipBtn.classList.add('hidden'); // Hide skip button
                matchmakingSocket.close();
                connectToChatRoom(roomName);
            }
        };

        matchmakingSocket.onclose = () => {
            statusText.textContent = 'Matchmaking connection closed.';
            skipBtn.classList.add('hidden'); // Hide skip button

            if (isSkipping) {
                // If we are skipping, immediately click "Find" again
                findChatBtn.click();
            } else {
                // Otherwise, just reset the UI
                findChatBtn.classList.remove('hidden');
                findChatBtn.disabled = false;
            }
        };

        matchmakingSocket.onerror = (e) => {
            console.error('Matchmaking socket error:', e);
            statusText.textContent = 'Error connecting to matchmaking. Check console.';
            skipBtn.classList.add('hidden');
        };
    });

    // --- Skip Button Logic ---
    skipBtn.addEventListener('click', () => {
        if (matchmakingSocket && matchmakingSocket.readyState === WebSocket.OPEN) {
            statusText.textContent = 'Skipping...';
            isSkipping = true; // Set flag
            matchmakingSocket.close(); // This will trigger 'onclose'
        }
    });


    // --- Chat Room Logic ---

    function connectToChatRoom(roomName) {
        waitingScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        messageInput.focus();

        const chatUrl = `wss://${RAILWAY_HOST}/ws/chat/${roomName}/`;
        chatSocket = new WebSocket(chatUrl);

        chatSocket.onopen = () => {
            addMessageToLog('Connected.', 'system');
        };

        chatSocket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            const message = data.message;
            
            if (message.startsWith('[')) {
                addMessageToLog(message, 'system');
            } else if (message === lastMessageSent) {
                // This is our echo. Ignore it.
                lastMessageSent = ""; // Clear the flag
            } else {
                addMessageToLog(message, 'partner');
            }
        };

        chatSocket.onclose = () => {
            addMessageToLog('[You have been disconnected]', 'system');
        };

        chatSocket.onerror = (e) => {
            console.error('Chat socket error:', e);
            addMessageToLog('[Connection error]', 'system');
        };
    }

    // --- Quit Button Logic ---
    quitBtn.addEventListener('click', () => {
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
            chatSocket.close();
        }

        chatScreen.classList.add('hidden');
        waitingScreen.classList.remove('hidden');
        chatLog.innerHTML = ''; // Clear chat log
        
        // Reset waiting screen
        statusText.textContent = 'Click the button to find a chat partner.';
        findChatBtn.classList.remove('hidden');
        findChatBtn.disabled = false;
        skipBtn.classList.add('hidden');
    });


    // --- Sending Messages ---

    messageSubmit.addEventListener('click', () => {
        sendMessage();
    });

    messageInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    function sendMessage() {
        const message = messageInput.value;
        if (message.trim() === '' || !chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
            return;
        }

        chatSocket.send(JSON.stringify({
            'message': message
        }));
        
        lastMessageSent = message; // Store message to check for echo
        addMessageToLog(message, 'self'); // Add to log immediately
        messageInput.value = '';
    }

    // --- UI Helper Function ---
    function addMessageToLog(message, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', type); 
        
        const textElement = document.createElement('p');
        textElement.textContent = message;
        
        messageElement.appendChild(textElement);
        chatLog.appendChild(messageElement);

        chatLog.scrollTop = chatLog.scrollHeight;
    }
});