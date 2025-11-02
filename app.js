document.addEventListener('DOMContentLoaded', () => {
    const RAILWAY_HOST = 'nitkigali-production.up.railway.app'; 
  
    // --- Generate a simple ID for this session ---
    // This is used to differentiate our messages from our partner's
    let localUserId = 'guest-' + Math.floor(Math.random() * 100000);

    // --- Screen and Button Elements ---
    const findChatBtn = document.getElementById('find-chat-btn');
    const skipBtn = document.getElementById('skip-btn'); // New button
    const statusText = document.getElementById('status-text');
    
    const waitingScreen = document.getElementById('waiting-screen');
    const chatScreen = document.getElementById('chat-screen');
    
    const quitBtn = document.getElementById('quit-btn'); // New button
    const chatLog = document.getElementById('chat-log');
    const messageInput = document.getElementById('chat-message-input');
    const messageSubmit = document.getElementById('chat-message-submit');

    let chatSocket = null;
    let matchmakingSocket = null;

    // --- Matchmaking Logic ---

    findChatBtn.addEventListener('click', () => {
        statusText.textContent = 'Connecting to matchmaking...';
        findChatBtn.disabled = true;
        
        const matchmakingUrl = `wss://${RAILWAY_HOST}/ws/find_chat/`;
        matchmakingSocket = new WebSocket(matchmakingUrl);

        matchmakingSocket.onopen = () => {
            statusText.textContent = 'Waiting for a partner...';
            skipBtn.classList.remove('hidden'); // Show skip button
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
            findChatBtn.disabled = false;
            skipBtn.classList.add('hidden'); // Hide skip button
        };

        matchmakingSocket.onerror = (e) => {
            console.error('Matchmaking socket error:', e);
            statusText.textContent = 'Error connecting to matchmaking. Check console.';
            findChatBtn.disabled = false;
            skipBtn.classList.add('hidden'); // Hide skip button
        };
    });

    // --- New Skip Button Logic ---
    skipBtn.addEventListener('click', () => {
        if (matchmakingSocket && matchmakingSocket.readyState === WebSocket.OPEN) {
            statusText.textContent = 'Skipping...';
            matchmakingSocket.close();
            // Re-trigger the find chat logic
            findChatBtn.click();
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
            addMessageToLog('Connected to chat room.', 'system');
        };

        // --- Message Received (ECHO FIX) ---
        chatSocket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            const message = data.message;
            const sender = data.sender; // Get the sender ID from the server

            if (message.startsWith('[')) {
                // This is a system message
                addMessageToLog(message, 'system');
            } else if (sender === localUserId) {
                // This is our *own* message echoed from the server
                addMessageToLog(message, 'self');
            } else {
                // This is a message from our partner
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

    // --- New Quit Button Logic ---
    quitBtn.addEventListener('click', () => {
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
            chatSocket.close();
        }

        // Go back to waiting screen
        chatScreen.classList.add('hidden');
        waitingScreen.classList.remove('hidden');

        // Clear the chat log for the next session
        chatLog.innerHTML = '';

        // Reset status text
        statusText.textContent = 'Click the button to find a chat partner.';
        findChatBtn.disabled = false;
    });


    // --- Sending Messages (ECHO FIX) ---

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

        // Send the message *with our local user ID*
        chatSocket.send(JSON.stringify({
            'message': message,
            'sender': localUserId 
        }));

        // --- We NO LONGER add the message to the log here ---
        // We wait for the server to send it back to us in onmessage
        
        messageInput.value = '';
    }

    // --- UI Helper Function ---

    function addMessageToLog(message, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', type); // 'system', 'self', or 'partner'
        
        const textElement = document.createElement('p');
        textElement.textContent = message;
        
        messageElement.appendChild(textElement);
        chatLog.appendChild(messageElement);

        // Auto-scroll to the bottom
        chatLog.scrollTop = chatLog.scrollHeight;
    }
});